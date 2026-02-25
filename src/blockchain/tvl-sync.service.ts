import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma.service';
import { BlockchainService } from './blockchain.service';

/**
 * Service to periodically sync TVL from on-chain to database
 * Ensures DB cached values stay accurate with on-chain state
 */
@Injectable()
export class TVLSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TVLSyncService.name);
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  // Sync interval in milliseconds (2 minutes for testing)
  private readonly SYNC_INTERVAL_MS = 2 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  onModuleInit() {
    this.logger.log(
      `TVL Sync Service initialized - running every ${this.SYNC_INTERVAL_MS / 1000} seconds`,
    );

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.syncAllPoolsTVL();
    }, this.SYNC_INTERVAL_MS);

    // Run initial sync after 10 seconds
    setTimeout(() => {
      this.syncAllPoolsTVL();
    }, 10000);
  }

  onModuleDestroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync TVL for all active pools
   */
  async syncAllPoolsTVL() {
    if (this.isRunning) {
      this.logger.debug('TVL sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('🔄 Starting TVL sync for all pools...');

    try {
      const pools = await this.prisma.pool.findMany({
        where: {
          isActive: true,
          poolAddress: { not: '' },
        },
        select: {
          id: true,
          chainId: true,
          poolAddress: true,
          poolType: true,
          name: true,
          assetDecimals: true,
        },
      });

      let synced = 0;
      let failed = 0;

      for (const pool of pools) {
        try {
          const { tvl } = await this.blockchain.getPoolTVL(
            pool.chainId,
            pool.poolAddress,
            pool.poolType as 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED',
          );

          const tvlDecimal = parseFloat(ethers.formatUnits(tvl, pool.assetDecimals));

          await this.prisma.poolAnalytics.update({
            where: { poolId: pool.id },
            data: { totalValueLocked: tvlDecimal },
          });

          synced++;
          this.logger.debug(`✅ Synced TVL for ${pool.name}: ${tvlDecimal.toFixed(2)}`);
        } catch (error) {
          failed++;
          this.logger.warn(`❌ Failed to sync TVL for ${pool.name}: ${error.message}`);
        }
      }

      this.logger.log(`🔄 TVL sync complete: ${synced} synced, ${failed} failed`);
    } catch (error) {
      this.logger.error(`TVL sync failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual sync for a specific pool
   */
  async syncPoolTVL(poolId: string): Promise<{ tvl: number; success: boolean }> {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      select: {
        id: true,
        chainId: true,
        poolAddress: true,
        poolType: true,
        name: true,
        assetDecimals: true,
      },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    try {
      const { tvl } = await this.blockchain.getPoolTVL(
        pool.chainId,
        pool.poolAddress,
        pool.poolType as 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED',
      );

      const tvlDecimal = parseFloat(ethers.formatUnits(tvl, pool.assetDecimals));

      await this.prisma.poolAnalytics.update({
        where: { poolId: pool.id },
        data: { totalValueLocked: tvlDecimal },
      });

      this.logger.log(`✅ Manual TVL sync for ${pool.name}: ${tvlDecimal.toFixed(2)}`);
      return { tvl: tvlDecimal, success: true };
    } catch (error) {
      this.logger.error(`Failed to sync TVL for ${pool.name}: ${error.message}`);
      return { tvl: 0, success: false };
    }
  }
}
