import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolBuilderService } from '../../blockchain/pool-builder.service';
import { PoolCreationWatcher } from '../../blockchain/pool-creation-watcher.service';
import { PoolCreationValidator } from './validators/pool-creation.validator';
import { CreatePoolDto, ConfirmPoolDeploymentDto } from './dtos/create-pool.dto';
import { PausePoolDto, ApproveAssetDto, ProcessMaturityDto } from './dtos/admin-operations.dto';
import { UpdatePoolMetadataDto } from './dtos/update-pool-metadata.dto';
import { ethers } from 'ethers';
import ManagerABI from '../../contracts/abis/Manager.json';
import PoolRegistryABI from '../../contracts/abis/PoolRegistry.json';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
    private poolBuilder: PoolBuilderService,
    private poolWatcher: PoolCreationWatcher,
    private poolValidator: PoolCreationValidator,
  ) {}

  /**
   * Create a new pool (stores metadata + returns unsigned transaction)
   */
  async createPool(dto: CreatePoolDto, chainId = 84532) {
    // 1. Validate inputs
    await this.poolValidator.validate(dto, chainId);

    // 2. Clean up any old pending pools with empty addresses (failed/cancelled deployments)
    const deletedCount = await this.prisma.pool.deleteMany({
      where: {
        chainId,
        poolAddress: '',
        status: 'PENDING_DEPLOYMENT',
      },
    });
    if (deletedCount.count > 0) {
      this.logger.log(
        `Cleaned up ${deletedCount.count} old pending pool(s) before creating new one`,
      );
    }

    // 3. Get asset details
    const assetContract = this.blockchain.getERC20(chainId, dto.asset);
    const [assetSymbol, assetDecimals] = await Promise.all([
      assetContract.symbol(),
      assetContract.decimals(),
    ]);

    // 4. Store pool metadata in database with PENDING_DEPLOYMENT status
    const pool = await this.prisma.pool.create({
      data: {
        chainId,
        poolAddress: '', // Will be updated after deployment
        poolType: dto.poolType,
        name: dto.name,
        description: dto.description,
        managerAddress: '', // Will be updated
        escrowAddress: '', // Will be updated
        assetAddress: dto.asset.toLowerCase(),
        assetSymbol,
        assetDecimals: Number(assetDecimals),
        minInvestment: dto.minInvestment,
        targetRaise: dto.targetRaise,
        epochEndTime: dto.epochEndTime ? new Date(dto.epochEndTime) : null,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
        discountRate: dto.discountRate,
        instrumentType: dto.instrumentType,
        status: 'PENDING_DEPLOYMENT',
        isActive: true,
        isFeatured: false,
        issuer: dto.issuer,
        issuerLogo: dto.issuerLogo,
        country: dto.country,
        region: dto.region,
        riskRating: dto.riskRating,
        securityType: dto.securityType,
        tags: dto.tags || [],
        createdOnChain: new Date(), // Will be updated to actual timestamp
      },
    });

    this.logger.log(`Pool metadata created: ${pool.id} - ${pool.name}`);

    // 4. Build unsigned transaction
    const txData = await this.poolBuilder.buildPoolCreationTx(chainId, {
      poolType: dto.poolType,
      asset: dto.asset,
      targetRaise: dto.targetRaise || '0',
      minInvestment: dto.minInvestment,
      epochEndTime: dto.epochEndTime ? new Date(dto.epochEndTime) : undefined,
      maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
      discountRate: dto.discountRate,
      instrumentType: dto.instrumentType,
      name: dto.name,
      spvAddress: dto.spvAddress,
    });

    this.logger.log(`Transaction data generated for pool ${pool.id}`);

    // Return full pool details for frontend
    return {
      poolId: pool.id,
      pool: {
        // Core identifiers
        id: pool.id,
        chainId: pool.chainId,
        poolAddress: pool.poolAddress, // Empty until deployed
        poolType: pool.poolType,
        status: pool.status,

        // Pool metadata
        name: pool.name,
        description: pool.description,
        issuer: pool.issuer,
        issuerLogo: pool.issuerLogo,
        country: pool.country,
        region: pool.region,
        riskRating: pool.riskRating,
        securityType: pool.securityType,
        tags: pool.tags,

        // Asset info
        assetAddress: pool.assetAddress,
        assetSymbol,
        assetDecimals: Number(assetDecimals),

        // Pool parameters
        minInvestment: pool.minInvestment,
        targetRaise: pool.targetRaise,
        epochEndTime: pool.epochEndTime,
        maturityDate: pool.maturityDate,
        discountRate: pool.discountRate,
        instrumentType: pool.instrumentType,
        spvAddress: pool.spvAddress,

        // Timestamps
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt,
        createdOnChain: pool.createdOnChain, // Will be updated by watcher

        // Flags
        isActive: pool.isActive,
        isFeatured: pool.isFeatured,
      },
      transaction: txData,
    };
  }

  /**
   * Manual confirmation of pool deployment (optional, watcher will auto-detect)
   */
  async confirmPoolDeployment(dto: ConfirmPoolDeploymentDto) {
    const success = await this.poolWatcher.confirmPoolDeployment(dto.poolId, dto.txHash);

    if (!success) {
      throw new BadRequestException('Failed to confirm pool deployment. Check transaction hash.');
    }

    const pool = await this.prisma.pool.findUnique({
      where: { id: dto.poolId },
      include: { analytics: true },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return {
      success: true,
      pool: {
        id: pool.id,
        name: pool.name,
        poolAddress: pool.poolAddress,
        status: pool.status,
        createdOnChain: pool.createdOnChain,
      },
    };
  }

  /**
   * Get all pools (including pending deployments) - Admin view
   */
  async getAllPools(includeInactive = false) {
    const pools = await this.prisma.pool.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by status
    const pending = pools.filter((p) => p.status === 'PENDING_DEPLOYMENT');
    const live = pools.filter((p) => p.status !== 'PENDING_DEPLOYMENT' && p.status !== 'CANCELLED');
    const cancelled = pools.filter((p) => p.status === 'CANCELLED');

    return {
      summary: {
        total: pools.length,
        pending: pending.length,
        live: live.length,
        cancelled: cancelled.length,
      },
      pools: {
        pending,
        live,
        cancelled,
      },
    };
  }

  /**
   * Get pool details by ID
   */
  async getPoolById(poolId: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        analytics: true,
        instruments: true,
        positions: {
          take: 10,
          orderBy: { totalDeposited: 'desc' },
          include: {
            user: {
              select: {
                walletAddress: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return pool;
  }

  async updatePoolMetadata(poolId: string, dto: UpdatePoolMetadataDto) {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const updateData: any = { ...dto };

    const updatedPool = await this.prisma.pool.update({
      where: { id: poolId },
      data: updateData,
      include: {
        analytics: true,
        instruments: true,
      },
    });

    this.logger.log(`Pool ${poolId} metadata updated`);

    return updatedPool;
  }

  /**
   * Cancel a pending pool deployment
   */
  async cancelPoolDeployment(poolId: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.status !== 'PENDING_DEPLOYMENT') {
      throw new BadRequestException('Only pending pools can be cancelled');
    }

    await this.prisma.pool.update({
      where: { id: poolId },
      data: {
        status: 'CANCELLED',
        isActive: false,
      },
    });

    this.logger.log(`Pool ${poolId} cancelled`);

    return { success: true, message: 'Pool deployment cancelled' };
  }

  async pausePool(dto: PausePoolDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const manager = this.blockchain.getContract(chainId, pool.managerAddress, ManagerABI);

    const data = manager.interface.encodeFunctionData('pausePool', [dto.poolAddress]);

    await this.prisma.pool.update({
      where: { id: pool.id },
      data: { isPaused: true },
    });

    return {
      transaction: {
        to: pool.managerAddress,
        data,
        value: '0',
        description: `Pause pool: ${pool.name}`,
      },
    };
  }

  async unpausePool(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const manager = this.blockchain.getContract(chainId, pool.managerAddress, ManagerABI);

    const data = manager.interface.encodeFunctionData('unpausePool', [poolAddress]);

    await this.prisma.pool.update({
      where: { id: pool.id },
      data: { isPaused: false },
    });

    return {
      transaction: {
        to: pool.managerAddress,
        data,
        value: '0',
        description: `Unpause pool: ${pool.name}`,
      },
    };
  }

  async approveAsset(dto: ApproveAssetDto, chainId = 84532) {
    const addresses = this.blockchain.getProvider(chainId);
    const poolRegistry = this.blockchain.getPoolRegistry(chainId);

    const data = poolRegistry.interface.encodeFunctionData('approveAsset', [
      dto.assetAddress,
      dto.riskRating || 'UNRATED',
    ]);

    return {
      transaction: {
        to: await poolRegistry.getAddress(),
        data,
        value: '0',
        description: `Approve asset: ${dto.symbol}`,
      },
      asset: {
        address: dto.assetAddress,
        symbol: dto.symbol,
        decimals: dto.decimals,
        riskRating: dto.riskRating,
      },
    };
  }

  async getAnalyticsOverview() {
    const [totalPools, activePools, totalTVL, totalInvestors, recentActivity] = await Promise.all([
      this.prisma.pool.count(),
      this.prisma.pool.count({ where: { isActive: true } }),
      this.prisma.poolAnalytics.aggregate({
        _sum: { totalValueLocked: true },
      }),
      this.prisma.user.count(),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              walletAddress: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const poolsByStatus = await this.prisma.pool.groupBy({
      by: ['status'],
      _count: true,
    });

    const poolsByType = await this.prisma.pool.groupBy({
      by: ['poolType'],
      _count: true,
      where: { isActive: true },
    });

    return {
      overview: {
        totalPools,
        activePools,
        totalTVL: totalTVL._sum.totalValueLocked || '0',
        totalInvestors,
      },
      poolsByStatus: poolsByStatus.reduce((acc: any, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      poolsByType: poolsByType.reduce((acc: any, item) => {
        acc[item.poolType] = item._count;
        return acc;
      }, {}),
      recentActivity,
    };
  }

  async getActivityLog(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              walletAddress: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
