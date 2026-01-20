import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolQueryDto } from './dtos/pool-query.dto';
import {
  PoolResponseDto,
  PoolDetailDto,
  PaginatedPoolsDto,
  LockTierDto,
  PoolAnalyticsDto,
} from './dtos/pool-response.dto';

@Injectable()
export class PoolsService {
  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  async findAll(query: PoolQueryDto): Promise<PaginatedPoolsDto> {
    const { page = 1, limit = 10, type, status, featured, country, region } = query;
    const skip = (page - 1) * limit;

    try {
      // Build where clause
      const where = {
        isActive: true,
        ...(type && { poolType: type }),
        ...(status && { status }),
        ...(featured !== undefined && { isFeatured: featured }),
        ...(country && { country }),
        ...(region && { region }),
      };

      // Get pools with analytics and lock tiers
      const [pools, total] = await Promise.all([
        this.prisma.pool.findMany({
          where,
          include: {
            analytics: true,
            lockTiers: {
              where: { isActive: true },
              orderBy: { tierIndex: 'asc' },
            },
          },
          skip,
          take: limit,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.pool.count({ where }),
      ]);

      const poolsDto: PoolResponseDto[] = pools.map((pool) => this.mapPoolToResponse(pool));

      return {
        data: poolsDto,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      // Return empty result if database not available
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }

  async findOne(poolAddress: string): Promise<PoolDetailDto> {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        isActive: true,
      },
      include: {
        analytics: true,
        lockTiers: {
          orderBy: { tierIndex: 'asc' },
        },
        instruments: {
          where: { isActive: true },
          orderBy: { maturityDate: 'asc' },
          take: 10,
        },
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 30,
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    return this.mapPoolToDetail(pool);
  }

  async findByChainAndAddress(chainId: number, poolAddress: string): Promise<PoolDetailDto> {
    const pool = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId,
          poolAddress: poolAddress.toLowerCase(),
        },
      },
      include: {
        analytics: true,
        lockTiers: {
          orderBy: { tierIndex: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} on chain ${chainId} not found`);
    }

    return this.mapPoolToDetail(pool);
  }

  async getFeaturedPools(): Promise<PoolResponseDto[]> {
    try {
      const pools = await this.prisma.pool.findMany({
        where: {
          isActive: true,
          isFeatured: true,
        },
        include: {
          analytics: true,
          lockTiers: {
            where: { isActive: true },
            orderBy: { tierIndex: 'asc' },
          },
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: 10,
      });

      return pools.map((pool) => this.mapPoolToResponse(pool));
    } catch (error) {
      return [];
    }
  }

  async getPoolStats(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
      include: {
        analytics: true,
        _count: {
          select: {
            positions: true,
            transactions: true,
            instruments: true,
            lockedPositions: true,
            lockTiers: true,
          },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    return {
      analytics: pool.analytics,
      counts: {
        positions: pool._count.positions,
        transactions: pool._count.transactions,
        instruments: pool._count.instruments,
        lockedPositions: pool._count.lockedPositions,
        lockTiers: pool._count.lockTiers,
      },
    };
  }

  /**
   * Get lock tiers for a specific pool
   */
  async getPoolTiers(poolAddress: string): Promise<LockTierDto[]> {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
      include: {
        lockTiers: {
          orderBy: { tierIndex: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    if (pool.poolType !== 'LOCKED') {
      return [];
    }

    return pool.lockTiers.map((tier) => ({
      id: tier.id,
      tierIndex: tier.tierIndex,
      durationDays: tier.durationDays,
      apyBps: tier.apyBps,
      earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
      minDeposit: tier.minDeposit.toString(),
      isActive: tier.isActive,
    }));
  }

  /**
   * Get live locked pool metrics from blockchain
   */
  async getLockedPoolMetrics(chainId: number, poolAddress: string) {
    try {
      const metrics = await this.blockchain.getLockedPoolMetrics(chainId, poolAddress);
      const pool = await this.prisma.pool.findFirst({
        where: { poolAddress: poolAddress.toLowerCase() },
      });

      if (!pool) {
        throw new NotFoundException(`Pool ${poolAddress} not found`);
      }

      return {
        totalPrincipal: metrics.totalPrincipal?.toString() || '0',
        totalInterestPaid: metrics.totalInterestPaid?.toString() || '0',
        totalPenalties: metrics.totalPenalties?.toString() || '0',
        activePositionCount: Number(metrics.activePositionCount || 0),
        totalPositionCount: Number(metrics.totalPositionCount || 0),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Preview interest calculation for a locked deposit
   */
  async previewLockedDeposit(
    chainId: number,
    poolAddress: string,
    amount: string,
    tierIndex: number,
  ) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
      include: { lockTiers: { where: { tierIndex } } },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    if (pool.poolType !== 'LOCKED') {
      throw new Error('Pool is not a Locked pool');
    }

    const tier = pool.lockTiers[0];
    if (!tier) {
      throw new NotFoundException(`Tier ${tierIndex} not found`);
    }

    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10 ** pool.assetDecimals));

    const preview = await this.blockchain.previewLockedInterest(
      chainId,
      poolAddress,
      amountBigInt,
      tierIndex,
    );

    return {
      principal: amount,
      tier: {
        index: tierIndex,
        durationDays: tier.durationDays,
        apyBps: tier.apyBps,
        earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
      },
      interest: (Number(preview.interest) / 10 ** pool.assetDecimals).toString(),
      investedAmount: (Number(preview.investedAmount) / 10 ** pool.assetDecimals).toString(),
      maturityPayout: (Number(preview.maturityPayout) / 10 ** pool.assetDecimals).toString(),
      lockEndDate: new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000),
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private mapPoolToResponse(pool: any): PoolResponseDto {
    const analytics = this.mapAnalytics(pool.analytics, pool.projectedAPY);
    const lockTiers = this.mapLockTiers(pool.lockTiers);

    return {
      id: pool.id,
      chainId: pool.chainId,
      poolAddress: pool.poolAddress,
      poolType: pool.poolType,
      name: pool.name,
      description: pool.description,
      assetSymbol: pool.assetSymbol,
      assetDecimals: pool.assetDecimals,
      minInvestment: pool.minInvestment.toString(),
      status: pool.status,
      isActive: pool.isActive,
      isFeatured: pool.isFeatured,
      country: pool.country,
      region: pool.region,
      issuer: pool.issuer,
      issuerLogo: pool.issuerLogo,
      securityType: pool.securityType,
      riskRating: pool.riskRating,
      targetRaise: pool.targetRaise?.toString() || null,
      epochEndTime: pool.epochEndTime,
      maturityDate: pool.maturityDate,
      discountRate: pool.discountRate,
      spvAddress: pool.spvAddress,
      lockTiers: pool.poolType === 'LOCKED' ? lockTiers : undefined,
      analytics,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
    };
  }

  private mapPoolToDetail(pool: any): PoolDetailDto {
    const base = this.mapPoolToResponse(pool);
    const lockTiers = this.mapLockTiers(pool.lockTiers);

    return {
      ...base,
      managerAddress: pool.managerAddress,
      escrowAddress: pool.escrowAddress,
      assetAddress: pool.assetAddress,
      isPaused: pool.isPaused,
      tags: pool.tags,
      cusip: pool.cusip,
      isin: pool.isin,
      prospectusUrl: pool.prospectusUrl,
      lockTiers: pool.poolType === 'LOCKED' ? lockTiers : undefined,
      createdOnChain: pool.createdOnChain,
    };
  }

  private mapAnalytics(analytics: any, projectedAPY: any): PoolAnalyticsDto | null {
    if (!analytics) return null;

    return {
      totalValueLocked: analytics.totalValueLocked.toString(),
      totalShares: analytics.totalShares.toString(),
      navPerShare: analytics.navPerShare?.toString() || null,
      uniqueInvestors: analytics.uniqueInvestors,
      apy: (analytics.apy || projectedAPY || 0).toString(),
      // Locked pool specific
      totalPrincipalLocked: analytics.totalPrincipalLocked?.toString(),
      totalInterestPaid: analytics.totalInterestPaid?.toString(),
      totalPenaltiesCollected: analytics.totalPenaltiesCollected?.toString(),
      activePositions: analytics.activePositions,
    };
  }

  private mapLockTiers(tiers: any[]): LockTierDto[] {
    if (!tiers || tiers.length === 0) return [];

    return tiers.map((tier) => ({
      id: tier.id,
      tierIndex: tier.tierIndex,
      durationDays: tier.durationDays,
      apyBps: tier.apyBps,
      earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
      minDeposit: tier.minDeposit.toString(),
      isActive: tier.isActive,
    }));
  }
}
