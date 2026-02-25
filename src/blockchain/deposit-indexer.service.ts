import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma.service';
import { UserType, TxStatus } from '@prisma/client';
import LiquidityPoolABI from '../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../contracts/abis/StableYieldPool.json';
import StableYieldEscrowABI from '../contracts/abis/StableYieldEscrow.json';

@Injectable()
export class DepositIndexer implements OnModuleInit {
  private readonly logger = new Logger(DepositIndexer.name);
  private isRunning = false;
  private readonly pollingInterval = 12000;

  constructor(private blockchain: BlockchainService, private prisma: PrismaService) {}

  onModuleInit() {
    this.start();
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('Deposit indexer already running');
      return;
    }
    this.isRunning = true;
    this.logger.log('💰 Deposit indexer started');
    this.pollForDeposits(84532);
  }

  stop() {
    this.isRunning = false;
    this.logger.log('Deposit indexer stopped');
  }

  private async pollForDeposits(chainId: number) {
    while (this.isRunning) {
      try {
        await this.indexDeposits(chainId);
      } catch (error) {
        this.logger.error(`Error in deposit indexer: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
    }
  }

  private async indexDeposits(chainId: number) {
    // Note: LOCKED pools have their own indexer (LockedPositionIndexer)
    // so we exclude them here
    const pools = await this.prisma.pool.findMany({
      where: {
        chainId,
        isActive: true,
        poolAddress: { not: '' },
        poolType: { not: 'LOCKED' },
      },
      select: {
        id: true,
        poolAddress: true,
        poolType: true,
        assetDecimals: true,
        assetSymbol: true,
        name: true,
        escrowAddress: true,
      },
    });

    const provider = this.blockchain.getProvider(chainId);
    const currentBlock = await provider.getBlockNumber();
    const lastCheckedBlock = (await this.getLastCheckedBlock(chainId)) || currentBlock - 100;

    if (currentBlock <= lastCheckedBlock) {
      return;
    }

    const fromBlock = lastCheckedBlock + 1;
    const maxBlockRange = parseInt(process.env.INDEXER_MAX_BLOCK_RANGE || '250', 10);
    const toBlock = Math.min(currentBlock, fromBlock + maxBlockRange - 1);

    this.logger.debug(`Checking deposits from block ${fromBlock} to ${toBlock} (range: ${toBlock - fromBlock + 1})`);

    for (const pool of pools) {
      await this.indexPoolDeposits(chainId, pool, fromBlock, toBlock);
    }

    await this.updateLastCheckedBlock(chainId, toBlock);
  }

  private async indexPoolDeposits(
    chainId: number,
    pool: {
      poolAddress: string;
      poolType: string;
      assetDecimals: number;
      assetSymbol: string;
      name: string;
      id: string;
      escrowAddress: string;
    },
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      const poolABI = pool.poolType === 'STABLE_YIELD' ? StableYieldPoolABI : LiquidityPoolABI;
      const poolContract = this.blockchain.getContract(chainId, pool.poolAddress, poolABI);

      const depositFilter = poolContract.filters.Deposit();
      const events = await poolContract.queryFilter(depositFilter, fromBlock, toBlock);

      for (const event of events) {
        await this.handleDepositEvent(chainId, pool, event as ethers.EventLog);
      }

      // For Stable Yield pools, also index FundsAllocated events from escrow
      if (pool.poolType === 'STABLE_YIELD' && pool.escrowAddress) {
        await this.indexEscrowFundsAllocated(chainId, pool, fromBlock, toBlock);
      }
    } catch (error) {
      this.logger.error(`Error indexing deposits for pool ${pool.poolAddress}: ${error.message}`);
    }
  }

  /**
   * Index FundsAllocated events from escrow to track fee allocation
   */
  private async indexEscrowFundsAllocated(
    chainId: number,
    pool: {
      poolAddress: string;
      name: string;
      id: string;
      escrowAddress: string;
      assetDecimals: number;
      assetSymbol: string;
    },
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      const escrowContract = this.blockchain.getContract(chainId, pool.escrowAddress, StableYieldEscrowABI);

      const fundsAllocatedFilter = escrowContract.filters.FundsAllocated();
      const events = await escrowContract.queryFilter(fundsAllocatedFilter, fromBlock, toBlock);

      for (const event of events) {
        await this.handleFundsAllocatedEvent(chainId, pool, event as ethers.EventLog);
      }
    } catch (error) {
      this.logger.warn(`Error indexing FundsAllocated for pool ${pool.name}: ${error.message}`);
    }
  }

  /**
   * Handle FundsAllocated event - track fee allocation
   */
  private async handleFundsAllocatedEvent(
    chainId: number,
    pool: {
      poolAddress: string;
      name: string;
      id: string;
      escrowAddress: string;
      assetDecimals: number;
      assetSymbol: string;
    },
    event: ethers.EventLog,
  ) {
    const { reserveAmount, transactionFee } = event.args;

    // Check if we've already processed this event (check AuditLog)
    const existingLog = await this.prisma.auditLog.findFirst({
      where: {
        action: 'FEE_ALLOCATED',
        entity: 'Pool',
        entityId: pool.id,
        changes: {
          path: ['txHash'],
          equals: event.transactionHash,
        },
      },
    });

    if (existingLog) {
      return; // Already processed
    }

    const reserveDecimal = ethers.formatUnits(reserveAmount, pool.assetDecimals);
    const feeDecimal = ethers.formatUnits(transactionFee, pool.assetDecimals);

    // Log fee allocation to AuditLog
    if (parseFloat(feeDecimal) > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: 'FEE_ALLOCATED',
          entity: 'Pool',
          entityId: pool.id,
          changes: {
            poolName: pool.name,
            poolAddress: pool.poolAddress,
            reserveAmount: reserveDecimal,
            transactionFee: feeDecimal,
            assetSymbol: pool.assetSymbol,
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
          },
        },
      });

      this.logger.log(
        `💵 Fee allocated: ${feeDecimal} ${pool.assetSymbol} from deposit to ${pool.name}`,
      );
    }
  }

  private async handleDepositEvent(
    chainId: number,
    pool: {
      poolAddress: string;
      poolType: string;
      assetDecimals: number;
      assetSymbol: string;
      name: string;
      id: string;
      escrowAddress: string;
    },
    event: ethers.EventLog,
  ) {
    const { sender, owner, assets, shares } = event.args;

    this.logger.log(
      `💰 Deposit detected: ${ethers.formatUnits(assets, pool.assetDecimals)} ${
        pool.assetSymbol
      } to ${pool.name}`,
    );

    const existingTx = await this.prisma.transaction.findUnique({
      where: { txHash: event.transactionHash },
    });

    if (existingTx) {
      this.logger.debug(`Transaction ${event.transactionHash} already indexed`);
      return;
    }

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    if (!block) {
      this.logger.error(`Block ${event.blockNumber} not found for tx ${event.transactionHash}`);
      return;
    }
    const timestamp = new Date(block.timestamp * 1000);

    const user = await this.prisma.user.upsert({
      where: { walletAddress: owner.toLowerCase() },
      update: {},
      create: {
        walletAddress: owner.toLowerCase(),
        userType: UserType.REGULAR_USER,
      },
    });

    const assetsDecimal = ethers.formatUnits(assets, pool.assetDecimals);
    const sharesDecimal = ethers.formatUnits(shares, pool.assetDecimals);

    const position = await this.prisma.poolPosition.upsert({
      where: {
        userId_poolId: {
          userId: user.id,
          poolId: pool.id,
        },
      },
      update: {
        totalDeposited: {
          increment: parseFloat(assetsDecimal),
        },
        totalShares: {
          increment: parseFloat(sharesDecimal),
        },
        currentValue: {
          increment: parseFloat(assetsDecimal),
        },
        lastDepositTime: timestamp,
        isActive: true,
      },
      create: {
        userId: user.id,
        poolId: pool.id,
        totalDeposited: parseFloat(assetsDecimal),
        totalWithdrawn: 0,
        totalShares: parseFloat(sharesDecimal),
        currentValue: parseFloat(assetsDecimal),
        unrealizedReturn: 0,
        realizedReturn: 0,
        isActive: true,
        lastDepositTime: timestamp,
      },
    });

    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: user.id,
        poolId: pool.id,
        chainId,
        type: 'DEPOSIT',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(assetsDecimal),
        shares: parseFloat(sharesDecimal),
        timestamp,
        blockNumber: BigInt(event.blockNumber),
      },
    });

    const isNewInvestor =
      parseFloat(assetsDecimal) === parseFloat(position.totalDeposited.toString());

    // First update shares, deposits, and flow metrics
    await this.prisma.poolAnalytics.update({
      where: { poolId: pool.id },
      data: {
        totalShares: {
          increment: parseFloat(sharesDecimal),
        },
        totalDeposits: {
          increment: parseFloat(assetsDecimal),
        },
        netFlow: {
          increment: parseFloat(assetsDecimal),
        },
        uniqueInvestors: isNewInvestor ? { increment: 1 } : undefined,
        depositors24h: { increment: 1 },
        volume24h: {
          increment: parseFloat(assetsDecimal),
        },
      },
    });

    // Then fetch accurate TVL from on-chain and update
    try {
      const { tvl } = await this.blockchain.getPoolTVL(
        chainId,
        pool.poolAddress,
        pool.poolType as 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED',
      );
      const tvlDecimal = parseFloat(ethers.formatUnits(tvl, pool.assetDecimals));

      await this.prisma.poolAnalytics.update({
        where: { poolId: pool.id },
        data: { totalValueLocked: tvlDecimal },
      });

      this.logger.log(`📊 Updated TVL for ${pool.name}: ${tvlDecimal.toFixed(2)}`);
    } catch (error) {
      // Fallback to increment if on-chain call fails
      this.logger.warn(`Could not fetch live TVL, using increment: ${error.message}`);
      await this.prisma.poolAnalytics.update({
        where: { poolId: pool.id },
        data: {
          totalValueLocked: {
            increment: parseFloat(assetsDecimal),
          },
        },
      });
    }

    // Create audit log entry for the deposit
    await this.prisma.auditLog.create({
      data: {
        action: 'USER_DEPOSIT',
        entity: 'Pool',
        entityId: pool.id,
        changes: {
          poolName: pool.name,
          poolAddress: pool.poolAddress,
          userAddress: owner.toLowerCase(),
          amount: assetsDecimal,
          shares: sharesDecimal,
          assetSymbol: pool.assetSymbol,
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          isNewInvestor,
        },
      },
    });

    this.logger.log(`✅ Deposit indexed: User ${owner.substring(0, 8)}... → ${pool.name}`);
  }

  private async getLastCheckedBlock(chainId: number): Promise<number | null> {
    const state = await this.prisma.indexerState.findUnique({
      where: { chainId_indexerType: { chainId, indexerType: 'DEPOSIT' } },
    });
    return state ? state.lastBlock : null;
  }

  private async updateLastCheckedBlock(chainId: number, blockNumber: number) {
    await this.prisma.indexerState.upsert({
      where: { chainId_indexerType: { chainId, indexerType: 'DEPOSIT' } },
      update: { lastBlock: blockNumber },
      create: { chainId, indexerType: 'DEPOSIT', lastBlock: blockNumber },
    });
  }
}
