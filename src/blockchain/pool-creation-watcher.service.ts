import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService, PoolType } from './blockchain.service';
import { PoolBuilderService } from './pool-builder.service';
import { PrismaService } from '../prisma.service';
import { PoolType as PrismaPoolType } from '@prisma/client';

@Injectable()
export class PoolCreationWatcher implements OnModuleInit {
  private readonly logger = new Logger(PoolCreationWatcher.name);
  private isWatching = false;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(
    private blockchain: BlockchainService,
    private poolBuilder: PoolBuilderService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Start watching on module initialization
    this.startWatching(84532); // Base Sepolia
  }

  /**
   * Start watching for pool creation events
   */
  async startWatching(chainId: number) {
    if (this.isWatching) {
      this.logger.warn('Pool creation watcher is already running');
      return;
    }

    this.isWatching = true;
    this.logger.log(`🔍 Pool creation watcher started for chain ${chainId}`);

    // Poll every 12 seconds (Base block time)
    this.watchInterval = setInterval(
      async () => {
        try {
          await this.checkForNewPools(chainId);
        } catch (error) {
          this.logger.error(`Error in pool creation watcher: ${error.message}`);
        }
      },
      12000, // 12 seconds
    );

    // Run immediately on start
    await this.checkForNewPools(chainId);
  }

  /**
   * Stop watching
   */
  stopWatching() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    this.isWatching = false;
    this.logger.log('Pool creation watcher stopped');
  }

  /**
   * Check for new pools from pending deployments
   */
  private async checkForNewPools(chainId: number) {
    // Get all pending deployment pools
    const pendingPools = await this.prisma.pool.findMany({
      where: {
        chainId,
        status: 'PENDING_DEPLOYMENT',
      },
    });

    if (pendingPools.length === 0) {
      return;
    }

    this.logger.log(`Checking ${pendingPools.length} pending pool(s) for deployment confirmation`);

    for (const pool of pendingPools) {
      await this.checkPoolDeployment(chainId, pool);
    }
  }

  /**
   * Check if a specific pool has been deployed
   */
  private async checkPoolDeployment(chainId: number, pool: any) {
    try {
      const registry = this.blockchain.getPoolRegistry(chainId);

      // Determine which registry method to use based on pool type
      let totalPools: bigint;
      let getPoolAtIndex: (index: number) => Promise<string>;
      let getPoolData: (poolAddress: string) => Promise<any>;

      switch (pool.poolType as PrismaPoolType) {
        case 'STABLE_YIELD':
          totalPools = await registry.totalStableYieldPools();
          getPoolAtIndex = (i) => registry.getStableYieldPoolAtIndex(i);
          getPoolData = (addr) => registry.getStableYieldPoolData(addr);
          break;
        case 'LOCKED':
          // For locked pools, use LockedPoolManager.getPoolConfig instead of registry
          const lockedManager = this.blockchain.getLockedPoolManager(pool.chainId);
          totalPools = await registry.totalLockedPools();
          getPoolAtIndex = (i) => registry.getLockedPoolAtIndex(i);
          getPoolData = (addr) => lockedManager.getPoolConfig(addr);
          break;
        case 'SINGLE_ASSET':
        default:
          totalPools = await registry.getPoolCount();
          getPoolAtIndex = (i) => registry.getPoolAtIndex(i);
          getPoolData = (addr) => registry.getPoolInfo(addr);
          break;
      }

      // Check last 10 pools (should cover recent deployments)
      const checkCount = Math.min(10, Number(totalPools));

      for (let i = Number(totalPools) - checkCount; i < Number(totalPools); i++) {
        if (i < 0) continue;

        const poolAddress = await getPoolAtIndex(i);
        const poolInfo = await getPoolData(poolAddress);

        // Match by asset address
        if (poolInfo.asset.toLowerCase() === pool.assetAddress.toLowerCase()) {
          // Check if this pool was created recently (within last 5 minutes)
          const now = Math.floor(Date.now() / 1000);
          const creationTime = Number(poolInfo.createdAt || poolInfo.timestamp || 0);

          if (now - creationTime < 300) {
            this.logger.log(`✅ Found deployed pool: ${poolAddress} for pending pool ${pool.id}`);

            // Update database with manager/escrow/spv
            // Note: Registry returns escrowAddress for StableYield, escrow for others
            const escrowAddr = poolInfo.escrowAddress || poolInfo.escrow || '';
            await this.prisma.pool.update({
              where: { id: pool.id },
              data: {
                poolAddress: poolAddress.toLowerCase(),
                managerAddress: poolInfo.manager?.toLowerCase() || '',
                escrowAddress: escrowAddr.toLowerCase(),
                spvAddress: poolInfo.spvAddress?.toLowerCase() || pool.spvAddress,
                status: pool.poolType === 'LOCKED' ? 'FUNDING' : 'FUNDING',
                createdOnChain: new Date(creationTime * 1000),
              },
            });

            // For Locked pools, also create lock tiers in database
            if (pool.poolType === 'LOCKED') {
              await this.createLockTiersForPool(chainId, pool.id, poolAddress);
            }

            // Create initial analytics record
            await this.prisma.poolAnalytics.create({
              data: {
                poolId: pool.id,
                totalValueLocked: 0,
                totalShares: 0,
                uniqueInvestors: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
              },
            });

            this.logger.log(`✅ Pool ${pool.name} deployed successfully at ${poolAddress}`);
            return;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error checking pool deployment for ${pool.id}: ${error.message}`);
    }
  }

  /**
   * Create lock tiers for a newly deployed locked pool
   */
  private async createLockTiersForPool(chainId: number, poolId: string, poolAddress: string) {
    try {
      const tiers = await this.poolBuilder.parseLockedPoolTiers(chainId, poolAddress);

      if (tiers.length === 0) {
        this.logger.warn(`No tiers found for locked pool ${poolAddress}`);
        return;
      }

      // Get asset decimals for conversion
      const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
      if (!pool) return;

      for (const tier of tiers) {
        await this.prisma.lockTier.create({
          data: {
            poolId: poolId,
            tierIndex: tier.tierIndex,
            durationDays: tier.durationDays,
            apyBps: tier.apyBps,
            earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
            minDeposit: parseFloat(ethers.formatUnits(tier.minDeposit, pool.assetDecimals)),
            isActive: tier.isActive,
          },
        });
      }

      this.logger.log(`✅ Created ${tiers.length} lock tiers for pool ${poolId}`);
    } catch (error) {
      this.logger.error(`Error creating lock tiers for pool ${poolId}: ${error.message}`);
    }
  }

  /**
   * Manual confirmation method (can be called by API endpoint)
   */
  async confirmPoolDeployment(poolId: string, txHash: string): Promise<boolean> {
    try {
      const pool = await this.prisma.pool.findUnique({
        where: { id: poolId },
      });

      if (!pool) {
        throw new Error('Pool not found');
      }

      if (pool.status !== 'PENDING_DEPLOYMENT') {
        throw new Error('Pool is not in PENDING_DEPLOYMENT status');
      }

      // Wait for transaction confirmation
      const receipt = await this.blockchain.waitForTransaction(pool.chainId, txHash, 1);

      // Parse PoolCreated event
      const eventData = this.poolBuilder.parsePoolCreatedEvent(
        receipt,
        pool.poolType as PoolType,
        pool.chainId,
      );

      if (!eventData) {
        throw new Error('PoolCreated event not found in transaction receipt');
      }

      // Update database
      await this.prisma.pool.update({
        where: { id: poolId },
        data: {
          poolAddress: eventData.poolAddress.toLowerCase(),
          escrowAddress: eventData.escrowAddress.toLowerCase(),
          status: 'FUNDING',
          createdOnChain: new Date(),
        },
      });

      // For Locked pools, create lock tiers
      if (pool.poolType === 'LOCKED') {
        await this.createLockTiersForPool(pool.chainId, poolId, eventData.poolAddress);
      }

      // Create initial analytics
      await this.prisma.poolAnalytics.create({
        data: {
          poolId: pool.id,
          totalValueLocked: 0,
          totalShares: 0,
          uniqueInvestors: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
        },
      });

      this.logger.log(`✅ Pool ${pool.name} confirmed via txHash ${txHash}`);
      return true;
    } catch (error) {
      this.logger.error(`Error confirming pool deployment: ${error.message}`);
      return false;
    }
  }
}
