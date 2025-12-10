import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolBuilderService } from '../../blockchain/pool-builder.service';
import { PoolCreationWatcher } from '../../blockchain/pool-creation-watcher.service';
import { PoolCreationValidator } from './validators/pool-creation.validator';
import { CreatePoolDto, ConfirmPoolDeploymentDto } from './dtos/create-pool.dto';
import { PausePoolDto, ApproveAssetDto, ProcessMaturityDto, CloseEpochDto, CancelPoolDto, DistributeCouponDto } from './dtos/admin-operations.dto';
import { ProcessWithdrawalQueueDto, WithdrawalQueueQueryDto } from './dtos/withdrawal-queue.dto';
import { GetRolePoolsDto } from './dtos/role-management.dto';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto } from './dtos/asset-management.dto';
import { WithdrawTreasuryDto, CollectFeesDto, UpdateFeeConfigDto, EmergencyActionDto } from './dtos/treasury-fee.dto';
import { UpdatePoolMetadataDto } from './dtos/update-pool-metadata.dto';
import { ethers } from 'ethers';
import ManagerABI from '../../contracts/abis/Manager.json';
import PoolRegistryABI from '../../contracts/abis/PoolRegistry.json';
import StableYieldManagerABI from '../../contracts/abis/StableYieldManager.json';
import AccessManagerABI from '../../contracts/abis/AccessManager.json';
import { CONTRACT_ADDRESSES } from '../../contracts/addresses';

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
    const [
      totalPools,
      activePools,
      totalTVL,
      totalInvestors,
      recentActivity,
      totalTransactions,
    ] = await Promise.all([
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
      this.prisma.transaction.count(),
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

    // Calculate weighted average APY
    const pools = await this.prisma.pool.findMany({
      where: { isActive: true },
      include: { analytics: true },
    });

    const tvlTotal = pools.reduce(
      (sum, p) => sum + Number(p.analytics?.totalValueLocked || 0),
      0,
    );
    const weightedAPY =
      tvlTotal > 0
        ? pools.reduce((sum, p) => {
            const apy = Number(p.analytics?.apy || p.projectedAPY || 0);
            const tvl = Number(p.analytics?.totalValueLocked || 0);
            return sum + (apy * tvl) / tvlTotal;
          }, 0)
        : 0;

    // Treasury & Fee Metrics (mock for now - will be replaced with FeeManager contract calls)
    const treasuryMetrics = {
      totalBalance: '0', // TODO: Query from FeeManager contract
      collectedFees: '0', // TODO: Query from FeeManager contract
      pendingFees: '0', // TODO: Calculate from pools
      protocolRevenue: '0', // TODO: Sum of all collected fees
    };

    return {
      overview: {
        totalPools,
        activePools,
        totalTVL: totalTVL._sum.totalValueLocked?.toString() || '0',
        totalInvestors,
        totalTransactions,
        averageAPY: weightedAPY.toFixed(2),
      },
      treasury: treasuryMetrics,
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

  /**
   * Close epoch for a pool (transition FUNDING → FILLED/PENDING_INVESTMENT)
   */
  async closeEpoch(dto: CloseEpochDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.status !== 'FUNDING') {
      throw new BadRequestException(
        `Cannot close epoch for pool with status: ${pool.status}. Must be FUNDING.`,
      );
    }

    // Check if epoch end time has passed
    if (pool.epochEndTime && new Date() < pool.epochEndTime) {
      throw new BadRequestException('Epoch end time has not passed yet');
    }

    const manager = this.blockchain.getContract(chainId, pool.managerAddress, ManagerABI);
    const data = manager.interface.encodeFunctionData('closeEpoch', [dto.poolAddress]);

    // Optimistically update status
    await this.prisma.pool.update({
      where: { id: pool.id },
      data: { status: 'FILLED' },
    });

    this.logger.log(`Closing epoch for pool: ${pool.name} (${pool.poolAddress})`);

    return {
      transaction: {
        to: pool.managerAddress,
        data,
        value: '0',
        description: `Close epoch for ${pool.name}`,
      },
      pool: {
        id: pool.id,
        name: pool.name,
        previousStatus: 'FUNDING',
        newStatus: 'FILLED',
      },
    };
  }

  /**
   * Cancel a pool (only FUNDING or PENDING_INVESTMENT status)
   */
  async cancelPool(dto: CancelPoolDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (!['FUNDING', 'PENDING_INVESTMENT', 'PENDING_DEPLOYMENT'].includes(pool.status)) {
      throw new BadRequestException(
        `Cannot cancel pool with status: ${pool.status}. Can only cancel FUNDING, PENDING_INVESTMENT, or PENDING_DEPLOYMENT pools.`,
      );
    }

    // If pool is deployed, need to call contract
    if (pool.poolAddress && pool.status !== 'PENDING_DEPLOYMENT') {
      const manager = this.blockchain.getContract(chainId, pool.managerAddress, ManagerABI);
      const data = manager.interface.encodeFunctionData('cancelPool', [dto.poolAddress]);

      await this.prisma.pool.update({
        where: { id: pool.id },
        data: {
          status: 'CANCELLED',
          isActive: false,
        },
      });

      // Log audit
      await this.prisma.auditLog.create({
        data: {
          action: 'CANCEL_POOL',
          entity: 'Pool',
          entityId: pool.id,
          changes: {
            reason: dto.reason,
            previousStatus: pool.status,
            newStatus: 'CANCELLED',
          },
          success: true,
        },
      });

      this.logger.log(`Pool cancelled: ${pool.name} - Reason: ${dto.reason}`);

      return {
        transaction: {
          to: pool.managerAddress,
          data,
          value: '0',
          description: `Cancel pool: ${pool.name}`,
        },
        pool: {
          id: pool.id,
          name: pool.name,
          status: 'CANCELLED',
          reason: dto.reason,
        },
      };
    }

    // For pending deployment, just update DB
    await this.prisma.pool.update({
      where: { id: pool.id },
      data: {
        status: 'CANCELLED',
        isActive: false,
      },
    });

    this.logger.log(`Pending pool cancelled: ${pool.name}`);

    return {
      success: true,
      pool: {
        id: pool.id,
        name: pool.name,
        status: 'CANCELLED',
        reason: dto.reason,
      },
    };
  }

  /**
   * Distribute coupon payment for a pool
   */
  async distributeCoupon(dto: DistributeCouponDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        instruments: {
          where: { isActive: true },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Coupon distribution is only for Stable Yield pools');
    }

    // Verify coupon hasn't been distributed yet
    const existingCoupon = await this.prisma.couponPayment.findFirst({
      where: {
        poolId: pool.id,
        couponNumber: dto.couponId,
        distributionStatus: 'DISTRIBUTED',
      },
    });

    if (existingCoupon) {
      throw new BadRequestException('Coupon has already been distributed');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
    const decimals = await assetContract.decimals();
    const amountWei = ethers.parseUnits(dto.amount, decimals);

    const data = stableYieldManager.interface.encodeFunctionData('distributeCoupon', [
      dto.poolAddress,
      dto.couponId,
      amountWei,
    ]);

    // Create coupon payment record
    await this.prisma.couponPayment.create({
      data: {
        poolId: pool.id,
        amount: dto.amount,
        couponNumber: dto.couponId,
        dueDate: new Date(),
        paidDate: new Date(),
        distributionStatus: 'RECEIVED',
        totalDistributed: dto.amount,
        totalClaimed: '0',
      },
    });

    const addresses = CONTRACT_ADDRESSES[chainId];

    this.logger.log(
      `Distributing coupon ${dto.couponId} for pool ${pool.name}: ${dto.amount} ${pool.assetSymbol}`,
    );

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Distribute coupon #${dto.couponId} for ${pool.name}`,
      },
      coupon: {
        couponId: dto.couponId,
        amount: dto.amount,
        asset: pool.assetSymbol,
        poolName: pool.name,
      },
    };
  }

  // ========== WITHDRAWAL QUEUES ==========

  /**
   * Get withdrawal queues with filters
   */
  async getWithdrawalQueues(query: WithdrawalQueueQueryDto) {
    const where: any = {};

    if (query.poolId) {
      where.poolId = query.poolId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const requests = await this.prisma.withdrawalRequest.findMany({
      where,
      include: {
        user: {
          select: {
            walletAddress: true,
            email: true,
          },
        },
        pool: {
          select: {
            name: true,
            poolAddress: true,
            assetSymbol: true,
          },
        },
      },
      orderBy: {
        requestTime: 'asc',
      },
    });

    const summary = {
      total: requests.length,
      queued: requests.filter((r) => r.status === 'QUEUED').length,
      processing: requests.filter((r) => r.status === 'PROCESSING').length,
      completed: requests.filter((r) => r.status === 'COMPLETED').length,
    };

    return {
      requests,
      summary,
    };
  }

  /**
   * Process withdrawal queue for a pool
   */
  async processWithdrawalQueue(dto: ProcessWithdrawalQueueDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Withdrawal queues are only for Stable Yield pools');
    }

    // Get pending withdrawal requests
    const pendingRequests = await this.prisma.withdrawalRequest.findMany({
      where: {
        poolId: pool.id,
        status: 'QUEUED',
      },
      take: dto.maxRequests,
      orderBy: {
        requestTime: 'asc',
      },
    });

    if (pendingRequests.length === 0) {
      throw new BadRequestException('No pending withdrawal requests found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const data = stableYieldManager.interface.encodeFunctionData('processWithdrawalQueue', [
      dto.poolAddress,
      dto.maxRequests,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    // Update statuses to PROCESSING
    await this.prisma.withdrawalRequest.updateMany({
      where: {
        id: {
          in: pendingRequests.map((r) => r.id),
        },
      },
      data: {
        status: 'PROCESSING',
      },
    });

    this.logger.log(
      `Processing ${pendingRequests.length} withdrawal requests for pool ${pool.name}`,
    );

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Process ${pendingRequests.length} withdrawal requests`,
      },
      summary: {
        poolName: pool.name,
        requestsToProcess: pendingRequests.length,
        totalQueued: pendingRequests.length,
      },
    };
  }

  // ========== ROLE MANAGEMENT ==========

  /**
   * Get role metrics and assignments
   */
  async getRoleMetrics() {
    // Get all users with their roles
    const users = await this.prisma.user.findMany({
      where: {
        userType: {
          not: 'REGULAR_USER',
        },
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        userType: true,
        isActive: true,
      },
    });

    // Get SPV assignments (Stable Yield pools with spvAddress)
    const spvAssignments = await this.prisma.pool.findMany({
      where: {
        poolType: 'STABLE_YIELD',
        spvAddress: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        poolAddress: true,
        spvAddress: true,
        status: true,
      },
    });

    // Count by role
    const roleDistribution = users.reduce((acc: any, user) => {
      acc[user.userType] = (acc[user.userType] || 0) + 1;
      return acc;
    }, {});

    return {
      summary: {
        totalAdmins: roleDistribution.ADMIN || 0,
        totalSPVManagers: roleDistribution.SPV_MANAGER || 0,
        totalOperators: roleDistribution.OPERATOR || 0,
        totalVerifiers: roleDistribution.VERIFIER || 0,
      },
      users,
      spvAssignments: spvAssignments.map((pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        poolAddress: pool.poolAddress,
        spvAddress: pool.spvAddress,
        status: pool.status,
      })),
    };
  }

  /**
   * Get pools filtered by role
   */
  async getRolePools(dto: GetRolePoolsDto) {
    const where: any = {
      isActive: true,
    };

    if (dto.status) {
      where.status = dto.status;
    }

    // Filter based on role
    if (dto.roleName === 'SPV_MANAGER') {
      where.poolType = 'STABLE_YIELD';
      if (dto.needsAction) {
        where.status = { in: ['FILLED', 'INVESTED'] };
      }
    }

    const pools = await this.prisma.pool.findMany({
      where,
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
          take: 5,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      role: dto.roleName,
      pools,
      summary: {
        total: pools.length,
        needingAction: dto.needsAction
          ? pools.filter((p) => ['FILLED', 'INVESTED'].includes(p.status)).length
          : 0,
      },
    };
  }

  // ========== ASSET MANAGEMENT ==========

  /**
   * Get all assets with filters
   */
  async getAssets(query: AssetQueryDto, chainId = 84532) {
    const where: any = {
      chainId,
    };

    if (query.status === 'active') {
      where.isApproved = true;
    } else if (query.status === 'pending') {
      where.isApproved = false;
    }

    if (query.region) {
      where.region = query.region;
    }

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      assets,
      summary: {
        total: assets.length,
        active: assets.filter((a) => a.isApproved).length,
        pending: assets.filter((a) => !a.isApproved).length,
      },
    };
  }

  /**
   * Create a new asset
   */
  async createAsset(dto: CreateAssetDto, chainId = 84532) {
    // Check if asset already exists
    const existing = await this.prisma.asset.findUnique({
      where: {
        chainId_address: {
          chainId,
          address: dto.address.toLowerCase(),
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Asset already exists');
    }

    const asset = await this.prisma.asset.create({
      data: {
        chainId,
        address: dto.address.toLowerCase(),
        symbol: dto.symbol,
        name: dto.name,
        decimals: dto.decimals,
        country: dto.country,
        region: dto.region,
        isStablecoin: dto.isStablecoin ?? true,
        isApproved: false, // Requires on-chain approval
        logoUrl: dto.logoUrl,
      },
    });

    // Build approval transaction
    const poolRegistry = this.blockchain.getPoolRegistry(chainId);
    const data = poolRegistry.interface.encodeFunctionData('approveAsset', [
      dto.address,
      dto.name,
      dto.symbol,
      dto.country || '',
      dto.region || '',
      dto.isStablecoin ?? true,
    ]);

    this.logger.log(`Asset created: ${dto.symbol} (${dto.address})`);

    return {
      asset,
      transaction: {
        to: await poolRegistry.getAddress(),
        data,
        value: '0',
        description: `Approve asset: ${dto.symbol}`,
      },
    };
  }

  /**
   * Update asset metadata
   */
  async updateAsset(assetId: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: dto,
    });

    this.logger.log(`Asset updated: ${asset.symbol}`);

    return updated;
  }

  /**
   * Revoke/Delete asset
   */
  async deleteAsset(assetId: string, chainId = 84532) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Check if asset is used in any active pools
    const poolsUsingAsset = await this.prisma.pool.count({
      where: {
        assetAddress: asset.address,
        isActive: true,
      },
    });

    if (poolsUsingAsset > 0) {
      throw new BadRequestException(
        `Cannot delete asset: ${poolsUsingAsset} active pools are using this asset`,
      );
    }

    // Mark as not approved instead of deleting
    await this.prisma.asset.update({
      where: { id: assetId },
      data: { isApproved: false },
    });

    this.logger.log(`Asset revoked: ${asset.symbol}`);

    return {
      success: true,
      message: `Asset ${asset.symbol} has been revoked`,
    };
  }

  // ========== TREASURY MANAGEMENT ==========

  /**
   * Get treasury overview
   */
  async getTreasuryOverview(chainId = 84532) {
    // Get recent treasury transactions
    const recentTransactions = await this.prisma.treasuryTransaction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals by asset
    const totalsByAsset = recentTransactions.reduce(
      (acc: Record<string, { collected: number; withdrawn: number }>, tx) => {
        if (!acc[tx.asset]) {
          acc[tx.asset] = { collected: 0, withdrawn: 0 };
        }
        if (tx.type === 'FEE_COLLECTION' || tx.type === 'PROTOCOL_REVENUE') {
          acc[tx.asset].collected += Number(tx.amount);
        } else if (tx.type === 'WITHDRAWAL') {
          acc[tx.asset].withdrawn += Number(tx.amount);
        }
        return acc;
      },
      {},
    );

    const totalCollected = Object.values(totalsByAsset).reduce(
      (sum: number, a) => sum + a.collected,
      0,
    );
    const totalWithdrawn = Object.values(totalsByAsset).reduce(
      (sum: number, a) => sum + a.withdrawn,
      0,
    );

    return {
      summary: {
        totalCollected: totalCollected.toString(),
        totalWithdrawn: totalWithdrawn.toString(),
      },
      byAsset: totalsByAsset,
      recentTransactions: recentTransactions.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
    };
  }

  /**
   * Withdraw from treasury
   */
  async withdrawTreasury(dto: WithdrawTreasuryDto, chainId = 84532) {
    // Note: FeeManager contract integration needed
    // For now, we'll create a transaction record

    const addresses = CONTRACT_ADDRESSES[chainId];
    
    // TODO: Build actual FeeManager.withdrawTreasury() call
    const data = '0x'; // Placeholder - need FeeManager ABI

    await this.prisma.treasuryTransaction.create({
      data: {
        type: 'WITHDRAWAL',
        asset: dto.asset,
        amount: dto.amount,
        recipient: dto.recipient,
        executedBy: 'admin',
        reason: dto.reason,
      },
    });

    this.logger.log(`Treasury withdrawal: ${dto.amount} ${dto.asset} to ${dto.recipient}`);

    return {
      transaction: {
        to: addresses.feeManager,
        data,
        value: '0',
        description: `Withdraw ${dto.amount} from treasury to ${dto.recipient}`,
      },
    };
  }

  // ========== FEE MANAGEMENT ==========

  /**
   * Get fee configuration and stats
   */
  async getFees(chainId = 84532) {
    const feeTransactions = await this.prisma.treasuryTransaction.findMany({
      where: {
        type: 'FEE_COLLECTION',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalCollected = feeTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    return {
      configuration: {
        // TODO: Query from FeeManager contract
        managementFee: 200, // 2% in basis points
        performanceFee: 2000, // 20% in basis points
        withdrawalFee: 50, // 0.5% in basis points
      },
      summary: {
        totalCollected: totalCollected.toString(),
        transactionCount: feeTransactions.length,
      },
      recentCollections: feeTransactions.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
    };
  }

  /**
   * Collect fees from a pool
   */
  async collectFees(dto: CollectFeesDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const addresses = CONTRACT_ADDRESSES[chainId];
    
    // TODO: Build FeeManager.collectFees(poolAddress) call
    const data = '0x'; // Placeholder - need FeeManager ABI

    this.logger.log(`Collecting fees from pool: ${pool.name}`);

    return {
      transaction: {
        to: addresses.feeManager,
        data,
        value: '0',
        description: `Collect fees from ${pool.name}`,
      },
    };
  }

  /**
   * Update fee configuration
   */
  async updateFeeConfig(dto: UpdateFeeConfigDto, chainId = 84532) {
    const addresses = CONTRACT_ADDRESSES[chainId];
    
    // TODO: Build FeeManager.setFeeRate(poolType, feeType, rate) call
    const data = '0x'; // Placeholder - need FeeManager ABI

    this.logger.log(`Updating ${dto.feeType} fee for ${dto.poolType} to ${dto.rate} basis points`);

    return {
      transaction: {
        to: addresses.feeManager,
        data,
        value: '0',
        description: `Update ${dto.feeType} fee to ${dto.rate / 100}%`,
      },
    };
  }

  // ========== EMERGENCY OPERATIONS ==========

  /**
   * Execute emergency action
   */
  async executeEmergencyAction(dto: EmergencyActionDto, chainId = 84532) {
    const addresses = CONTRACT_ADDRESSES[chainId];
    let data: string;
    let target: string;
    let description: string;

    const manager = this.blockchain.getContract(chainId, addresses.manager, ManagerABI);

    if (dto.action === 'PAUSE') {
      // Pause entire protocol or specific pool
      if (dto.poolAddress) {
        data = manager.interface.encodeFunctionData('pausePool', [dto.poolAddress]);
        description = `Emergency pause pool: ${dto.poolAddress}`;
      } else {
        data = manager.interface.encodeFunctionData('emergencyPause', []);
        description = 'Emergency pause ALL pools';
      }
      target = addresses.manager;
    } else if (dto.action === 'UNPAUSE') {
      if (dto.poolAddress) {
        data = manager.interface.encodeFunctionData('unpausePool', [dto.poolAddress]);
        description = `Unpause pool: ${dto.poolAddress}`;
      } else {
        data = manager.interface.encodeFunctionData('emergencyUnpause', []);
        description = 'Unpause ALL pools';
      }
      target = addresses.manager;
    } else if (dto.action === 'FORCE_CLOSE_EPOCH') {
      if (!dto.poolAddress) {
        throw new BadRequestException('poolAddress required for FORCE_CLOSE_EPOCH');
      }
      data = manager.interface.encodeFunctionData('forceCloseEpoch', [dto.poolAddress]);
      description = `Force close epoch for pool: ${dto.poolAddress}`;
      target = addresses.manager;
    } else {
      throw new BadRequestException('Invalid emergency action');
    }

    // Log emergency action
    await this.prisma.emergencyAction.create({
      data: {
        action: dto.action,
        reason: dto.reason,
        poolAddress: dto.poolAddress,
        executedBy: 'admin',
      },
    });

    this.logger.warn(`EMERGENCY ACTION: ${dto.action} - Reason: ${dto.reason}`);

    return {
      transaction: {
        to: target,
        data,
        value: '0',
        description,
      },
      emergency: {
        action: dto.action,
        reason: dto.reason,
        poolAddress: dto.poolAddress,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get system status
   */
  async getSystemStatus(chainId = 84532) {
    const provider = this.blockchain.getProvider(chainId);
    const addresses = CONTRACT_ADDRESSES[chainId];

    try {
      const [blockNumber, gasPrice, dbStatus] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
        this.prisma.$queryRaw`SELECT 1`, // DB health check
      ]);

      // Get indexer states
      const indexers = await this.prisma.indexerState.findMany({
        where: { chainId },
      });

      // Get contract statuses
      const manager = this.blockchain.getContract(chainId, addresses.manager, ManagerABI);
      const poolRegistry = this.blockchain.getPoolRegistry(chainId);

      const [totalPools, activePools] = await Promise.all([
        poolRegistry.getPoolCount(),
        this.prisma.pool.count({ where: { chainId, isActive: true } }),
      ]);

      return {
        blockchain: {
          chainId,
          provider: 'connected',
          blockNumber,
          gasPrice: gasPrice.gasPrice?.toString() || '0',
          lastChecked: new Date().toISOString(),
        },
        indexers: indexers.map((idx) => ({
          type: idx.indexerType,
          lastBlock: Number(idx.lastBlock),
          status: 'running',
          lastSync: idx.updatedAt.toISOString(),
        })),
        database: {
          status: dbStatus ? 'healthy' : 'unhealthy',
          pools: { total: Number(totalPools), active: activePools },
        },
        contracts: {
          manager: { address: addresses.manager, paused: false },
          poolRegistry: { address: addresses.poolRegistry, totalPools: Number(totalPools) },
          stableYieldManager: { address: addresses.stableYieldManager },
          feeManager: { address: addresses.feeManager },
        },
      };
    } catch (error) {
      this.logger.error(`System status check failed: ${error.message}`);
      throw new BadRequestException('Failed to get system status');
    }
  }
}
