import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);
  private readonly defaultChainId = 84532; // Base Sepolia

  constructor(
    private blockchain: BlockchainService,
    private prisma: PrismaService,
  ) {}

  /**
   * Fee type constants
   */
  private readonly FEE_TYPES = {
    DEPOSIT: 0,
    WITHDRAWAL: 1,
    EARLY_EXIT: 2,
    PERFORMANCE: 3,
    TRANSACTION: 4,
  };

  /**
   * Get current fee split configuration by fee type
   */
  async getFeeSplit(feeType?: number, chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const type = feeType ?? this.FEE_TYPES.DEPOSIT;
    const feeSplit = await this.blockchain.getFeeSplit(chain, type);

    return {
      chainId: chain,
      feeType: type,
      treasuryBps: Number(feeSplit.treasuryBps),
      reserveBps: Number(feeSplit.reserveBps),
      opsBps: Number(feeSplit.opsBps),
      active: feeSplit.active,
      treasuryPercent: (Number(feeSplit.treasuryBps) / 100).toFixed(2),
      reservePercent: (Number(feeSplit.reserveBps) / 100).toFixed(2),
      opsPercent: (Number(feeSplit.opsBps) / 100).toFixed(2),
    };
  }

  /**
   * Get all fee splits for all fee types
   */
  async getAllFeeSplits(chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const splits = await Promise.all(
      Object.entries(this.FEE_TYPES).map(async ([name, type]) => {
        const split = await this.blockchain.getFeeSplit(chain, type);
        return {
          feeType: type,
          feeTypeName: name,
          treasuryBps: Number(split.treasuryBps),
          reserveBps: Number(split.reserveBps),
          opsBps: Number(split.opsBps),
          active: split.active,
        };
      }),
    );

    return {
      chainId: chain,
      splits,
    };
  }

  /**
   * Get protocol fees summary (total collected, distributed, pending)
   */
  async getProtocolFeesSummary(chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const summary = await this.blockchain.getProtocolFeesSummary(chain);

    return {
      chainId: chain,
      totalFeesCollectedAllTime: summary.totalCollectedAllTime.toString(),
      pendingDistribution: summary.pendingDistribution.toString(),
      distributedToTreasury: summary.distributedToTreasury.toString(),
      distributedToReserve: summary.distributedToReserve.toString(),
      distributedToOps: summary.distributedToOps.toString(),
      assetCount: Number(summary.assetCount),
    };
  }

  /**
   * Get fee statistics for a specific asset
   */
  async getAssetFeeStats(assetAddress: string, chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const stats = await this.blockchain.getFeeAssetStats(chain, assetAddress);

    return {
      chainId: chain,
      assetAddress,
      totalCollected: stats.totalCollected.toString(),
      totalDistributed: stats.totalDistributed.toString(),
      pending: (stats.totalCollected - stats.totalDistributed).toString(),
      treasuryCollected: stats.treasuryCollected.toString(),
      reserveCollected: stats.reserveCollected.toString(),
      opsCollected: stats.opsCollected.toString(),
    };
  }

  /**
   * Get pending fee distributions for a specific asset
   */
  async getPendingDistributions(assetAddress: string, chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const pending = await this.blockchain.getPendingDistributions(chain, assetAddress);

    return {
      chainId: chain,
      assetAddress,
      treasuryPending: pending.treasuryPending.toString(),
      reservePending: pending.reservePending.toString(),
      opsPending: pending.opsPending.toString(),
      totalPending: (
        pending.treasuryPending +
        pending.reservePending +
        pending.opsPending
      ).toString(),
    };
  }

  /**
   * Get pending distributions for all tracked assets
   */
  async getAllPendingDistributions(chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const assets = await this.blockchain.getFeeTrackedAssets(chain);

    const distributions = await Promise.all(
      assets.map(async (asset: string) => {
        const pending = await this.blockchain.getPendingDistributions(chain, asset);
        return {
          asset,
          treasuryPending: pending.treasuryPending.toString(),
          reservePending: pending.reservePending.toString(),
          opsPending: pending.opsPending.toString(),
        };
      }),
    );

    return {
      chainId: chain,
      distributions,
    };
  }

  /**
   * Get effective deposit fee for a pool
   */
  async getPoolDepositFee(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    let effectiveFeeBps: bigint;

    if (pool.poolType === 'LOCKED') {
      effectiveFeeBps = await this.blockchain.getLockedPoolEffectiveDepositFee(
        pool.chainId,
        poolAddress,
      );
    } else if (pool.poolType === 'STABLE_YIELD') {
      effectiveFeeBps = await this.blockchain.getStableYieldEffectiveDepositFee(
        pool.chainId,
        poolAddress,
      );
    } else {
      effectiveFeeBps = await this.blockchain.getSingleAssetDepositFee(
        pool.chainId,
        poolAddress,
      );
    }

    return {
      poolAddress,
      poolType: pool.poolType,
      effectiveFeeBps: Number(effectiveFeeBps),
      effectiveFeePercent: (Number(effectiveFeeBps) / 100).toFixed(2),
    };
  }

  /**
   * Get all fee rates for a pool (deposit, withdrawal, early exit)
   */
  async getPoolFeeRates(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    const fees: any = {
      poolAddress,
      poolType: pool.poolType,
      chainId: pool.chainId,
    };

    if (pool.poolType === 'LOCKED') {
      fees.depositFeeBps = Number(
        await this.blockchain.getLockedPoolEffectiveDepositFee(pool.chainId, poolAddress),
      );

      // Get early exit penalty from tiers
      const tiers = await this.blockchain.getPoolTiers(pool.chainId, poolAddress);
      fees.tiers = tiers.map((tier: any, index: number) => ({
        tierIndex: index,
        earlyExitPenaltyBps: Number(tier.earlyExitPenaltyBps),
        earlyExitPenaltyPercent: (Number(tier.earlyExitPenaltyBps) / 100).toFixed(2),
      }));
    } else if (pool.poolType === 'STABLE_YIELD') {
      fees.depositFeeBps = Number(
        await this.blockchain.getStableYieldEffectiveDepositFee(pool.chainId, poolAddress),
      );
      fees.withdrawalFeeBps = 0; // Stable Yield has no withdrawal fee (queued)
    } else {
      fees.depositFeeBps = Number(
        await this.blockchain.getSingleAssetDepositFee(pool.chainId, poolAddress),
      );
      fees.withdrawalFeeBps = 0; // Single asset typically has no withdrawal fee
    }

    fees.depositFeePercent = (fees.depositFeeBps / 100).toFixed(2);

    return fees;
  }

  /**
   * Calculate fee for a specific deposit amount
   */
  async calculateDepositFee(poolAddress: string, amount: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolAddress}`);
    }

    const amountBigInt = BigInt(
      Math.floor(parseFloat(amount) * 10 ** pool.assetDecimals),
    );

    let effectiveFeeBps: bigint;

    if (pool.poolType === 'LOCKED') {
      effectiveFeeBps = await this.blockchain.getLockedPoolEffectiveDepositFee(
        pool.chainId,
        poolAddress,
      );
    } else if (pool.poolType === 'STABLE_YIELD') {
      effectiveFeeBps = await this.blockchain.getStableYieldEffectiveDepositFee(
        pool.chainId,
        poolAddress,
      );
    } else {
      effectiveFeeBps = await this.blockchain.getSingleAssetDepositFee(
        pool.chainId,
        poolAddress,
      );
    }

    const feeAmount = (amountBigInt * effectiveFeeBps) / BigInt(10000);
    const netAmount = amountBigInt - feeAmount;

    return {
      poolAddress,
      poolType: pool.poolType,
      grossAmount: amount,
      feeAmountRaw: feeAmount.toString(),
      feeAmount: (Number(feeAmount) / 10 ** pool.assetDecimals).toString(),
      netAmountRaw: netAmount.toString(),
      netAmount: (Number(netAmount) / 10 ** pool.assetDecimals).toString(),
      feeRateBps: Number(effectiveFeeBps),
      feeRatePercent: (Number(effectiveFeeBps) / 100).toFixed(2),
    };
  }

  /**
   * Get fee analytics across all pools
   */
  async getFeeAnalytics(chainId?: number) {
    const chain = chainId || this.defaultChainId;

    const [depositFeeSplit, summary] = await Promise.all([
      this.blockchain.getFeeSplit(chain, this.FEE_TYPES.DEPOSIT),
      this.blockchain.getProtocolFeesSummary(chain),
    ]);

    // Get pool counts by type
    const poolCounts = await this.prisma.pool.groupBy({
      by: ['poolType'],
      where: { chainId: chain },
      _count: true,
    });

    return {
      chainId: chain,
      depositFeeSplit: {
        treasuryBps: Number(depositFeeSplit.treasuryBps),
        reserveBps: Number(depositFeeSplit.reserveBps),
        opsBps: Number(depositFeeSplit.opsBps),
        active: depositFeeSplit.active,
      },
      totals: {
        feesCollectedAllTime: summary.totalCollectedAllTime.toString(),
        distributedToTreasury: summary.distributedToTreasury.toString(),
        distributedToReserve: summary.distributedToReserve.toString(),
        distributedToOps: summary.distributedToOps.toString(),
        pendingDistribution: summary.pendingDistribution.toString(),
      },
      poolBreakdown: poolCounts.map((pc) => ({
        poolType: pc.poolType,
        count: pc._count,
      })),
    };
  }
}
