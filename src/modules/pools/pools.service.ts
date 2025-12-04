import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PoolQueryDto } from './dtos/pool-query.dto';
import { PoolResponseDto, PoolDetailDto, PaginatedPoolsDto } from './dtos/pool-response.dto';

@Injectable()
export class PoolsService {
  constructor(private prisma: PrismaService) {}

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

      // Get pools with analytics
      const [pools, total] = await Promise.all([
        this.prisma.pool.findMany({
          where,
          include: {
            analytics: true,
          },
          skip,
          take: limit,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.pool.count({ where }),
      ]);

      const poolsDto: PoolResponseDto[] = pools.map((pool) => ({
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
        analytics: pool.analytics
          ? {
              totalValueLocked: pool.analytics.totalValueLocked.toString(),
              totalShares: pool.analytics.totalShares.toString(),
              navPerShare: pool.analytics.navPerShare?.toString() || null,
              uniqueInvestors: pool.analytics.uniqueInvestors,
              apy: (pool.analytics.apy || pool.projectedAPY || 0).toString(),
            }
          : null,
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt,
      }));

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
        instruments: {
          where: { isActive: true },
          orderBy: { maturityDate: 'asc' },
          take: 10,
        },
        snapshots: {
          orderBy: { timestamp: 'desc' },
          take: 30, // Last 30 snapshots
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    const poolDetail: PoolDetailDto = {
      id: pool.id,
      chainId: pool.chainId,
      poolAddress: pool.poolAddress,
      poolType: pool.poolType,
      name: pool.name,
      description: pool.description,
      assetSymbol: pool.assetSymbol,
      assetDecimals: pool.assetDecimals,
      assetAddress: pool.assetAddress,
      minInvestment: pool.minInvestment.toString(),
      managerAddress: pool.managerAddress,
      escrowAddress: pool.escrowAddress,
      status: pool.status,
      isActive: pool.isActive,
      isFeatured: pool.isFeatured,
      isPaused: pool.isPaused,
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
      tags: pool.tags,
      cusip: pool.cusip,
      isin: pool.isin,
      prospectusUrl: pool.prospectusUrl,
      analytics: pool.analytics
        ? {
            totalValueLocked: pool.analytics.totalValueLocked.toString(),
            totalShares: pool.analytics.totalShares.toString(),
            navPerShare: pool.analytics.navPerShare?.toString() || null,
            uniqueInvestors: pool.analytics.uniqueInvestors,
            apy: (pool.analytics.apy || pool.projectedAPY || 0).toString(),
          }
        : null,
      createdAt: pool.createdAt,
      createdOnChain: pool.createdOnChain,
      updatedAt: pool.updatedAt,
    };

    return poolDetail;
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
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} on chain ${chainId} not found`);
    }

    return {
      id: pool.id,
      chainId: pool.chainId,
      poolAddress: pool.poolAddress,
      poolType: pool.poolType,
      name: pool.name,
      description: pool.description,
      assetSymbol: pool.assetSymbol,
      assetDecimals: pool.assetDecimals,
      assetAddress: pool.assetAddress,
      minInvestment: pool.minInvestment.toString(),
      managerAddress: pool.managerAddress,
      escrowAddress: pool.escrowAddress,
      status: pool.status,
      isActive: pool.isActive,
      isFeatured: pool.isFeatured,
      isPaused: pool.isPaused,
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
      tags: pool.tags,
      cusip: pool.cusip,
      isin: pool.isin,
      prospectusUrl: pool.prospectusUrl,
      analytics: pool.analytics
        ? {
            totalValueLocked: pool.analytics.totalValueLocked.toString(),
            totalShares: pool.analytics.totalShares.toString(),
            navPerShare: pool.analytics.navPerShare?.toString() || null,
            uniqueInvestors: pool.analytics.uniqueInvestors,
            apy: (pool.analytics.apy || pool.projectedAPY || 0).toString(),
          }
        : null,
      createdAt: pool.createdAt,
      createdOnChain: pool.createdOnChain,
      updatedAt: pool.updatedAt,
    };
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
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: 10,
      });

      return pools.map((pool) => ({
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
        analytics: pool.analytics
          ? {
              totalValueLocked: pool.analytics.totalValueLocked.toString(),
              totalShares: pool.analytics.totalShares.toString(),
              navPerShare: pool.analytics.navPerShare?.toString() || null,
              uniqueInvestors: pool.analytics.uniqueInvestors,
              apy: (pool.analytics.apy || pool.projectedAPY || 0).toString(),
            }
          : null,
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt,
      }));
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
      },
    };
  }
}
