import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolBuilderService } from '../../blockchain/pool-builder.service';
import { PoolCreationWatcher } from '../../blockchain/pool-creation-watcher.service';
import { PoolCreationValidator } from './validators/pool-creation.validator';
import { CreatePoolDto, ConfirmPoolDeploymentDto } from './dtos/create-pool.dto';
import {
  PausePoolDto,
  ApproveAssetDto,
  ProcessMaturityDto,
  CloseEpochDto,
  CancelPoolDto,
  DistributeCouponDto,
} from './dtos/admin-operations.dto';
import { ProcessWithdrawalQueueDto, WithdrawalQueueQueryDto } from './dtos/withdrawal-queue.dto';
import { GetRolePoolsDto } from './dtos/role-management.dto';
import { CreateAssetDto, UpdateAssetDto, AssetQueryDto } from './dtos/asset-management.dto';
import {
  WithdrawTreasuryDto,
  CollectFeesDto,
  UpdateFeeConfigDto,
  EmergencyActionDto,
} from './dtos/treasury-fee.dto';
import { UpdatePoolMetadataDto } from './dtos/update-pool-metadata.dto';
import { AllocateToSPVDto, RebalancePoolReservesDto } from './dtos/spv-allocation.dto';
import { ethers } from 'ethers';
import ManagerABI from '../../contracts/abis/Manager.json';
import PoolRegistryABI from '../../contracts/abis/PoolRegistry.json';
import StableYieldManagerABI from '../../contracts/abis/StableYieldManager.json';
import AccessManagerABI from '../../contracts/abis/AccessManager.json';
import { CONTRACT_ADDRESSES } from '../../contracts/addresses';

// Contract constants matching StableYieldManager
const RESERVE_RATIO_BPS = 1000; // 10% - hardcoded in contract
const RESERVE_TOLERANCE_BPS = 200; // 2%
const MIN_RESERVE_BPS = 800; // 8% (10% - 2%)

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
    const [totalPools, activePools, totalTVL, totalInvestors, recentActivity, totalTransactions] =
      await Promise.all([
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

    const tvlTotal = pools.reduce((sum, p) => sum + Number(p.analytics?.totalValueLocked || 0), 0);
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

    // Validate: Only Single Asset pools have epochs
    if (pool.poolType === 'STABLE_YIELD') {
      throw new BadRequestException(
        'Stable Yield pools do not have epochs - they operate continuously. ' +
          'Use allocate-to-spv endpoint instead.',
      );
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

    const totalCollected = feeTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

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

  // ========== STABLE YIELD SPECIFIC: SPV FUND ALLOCATION ==========

  /**
   * Allocate funds from escrow to SPV for instrument purchases
   * OPERATOR_ROLE only - NOT SPV!
   * Critical: Validates reserve requirements before allocation
   */
  async allocateToSPV(dto: AllocateToSPVDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    // Validate: Only Stable Yield pools
    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Only Stable Yield pools support SPV operations');
    }

    // Validate: Pool must be in appropriate status
    if (!['FUNDING', 'FILLED', 'INVESTED', 'PENDING_INVESTMENT'].includes(pool.status)) {
      throw new BadRequestException(`Cannot allocate funds from pool with status: ${pool.status}`);
    }

    // Validate: SPV address
    if (!ethers.isAddress(dto.spvAddress)) {
      throw new BadRequestException('Invalid SPV address');
    }

    const requestedAmount = parseFloat(dto.amount);
    if (requestedAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // CRITICAL: Query reserve status from contract
    try {
      const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
      const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
      const decimals = await assetContract.decimals();
      const amountWei = ethers.parseUnits(dto.amount, decimals);

      // Get current reserve status from contract
      const reserveStatus = await stableYieldManager.getReserveStatus(pool.poolAddress);

      const currentReserve = Number(ethers.formatUnits(reserveStatus.currentReserve, decimals));
      const targetReserve = Number(ethers.formatUnits(reserveStatus.targetReserve, decimals));
      const reserveRatio = Number(reserveStatus.reserveRatio); // in basis points

      // CRITICAL: Also check cashBuffer (what contract actually validates)
      const poolData = await stableYieldManager.getPoolData(pool.poolAddress);
      const escrowAddress = poolData.escrowAddress;
      const escrowAbi = [
        'function getCashBuffer() external view returns (uint256)',
        'function getPoolReserves() external view returns (uint256)',
      ];
      const escrowContract = new ethers.Contract(
        escrowAddress,
        escrowAbi,
        this.blockchain.getProvider(chainId),
      );
      const cashBuffer = await escrowContract.getCashBuffer();
      const cashBufferFormatted = Number(ethers.formatUnits(cashBuffer, decimals));

      // Contract checks cashBuffer, not poolReserves
      if (cashBufferFormatted < requestedAmount) {
        throw new BadRequestException(
          `Insufficient cash buffer. Available: ${cashBufferFormatted.toFixed(2)} ${
            pool.assetSymbol
          }, ` +
            `Requested: ${requestedAmount.toFixed(2)} ${pool.assetSymbol}. ` +
            `Note: Pool reserves (${currentReserve.toFixed(2)}) may include allocated fees.`,
        );
      }

      // Calculate reserve after allocation
      const reserveAfter = currentReserve - requestedAmount;

      // Minimum acceptable reserve (8% = 80% of 10% target)
      const minAcceptableReserve = targetReserve * 0.8;

      // ENFORCE: Reserve requirements
      if (reserveAfter < minAcceptableReserve) {
        throw new BadRequestException(
          `Reserve violation: Allocation would leave ${reserveAfter.toFixed(2)} ${
            pool.assetSymbol
          }, ` +
            `but minimum required is ${minAcceptableReserve.toFixed(2)} ${
              pool.assetSymbol
            } (8% of NAV). ` +
            `Current reserve: ${currentReserve.toFixed(2)}, Target: ${targetReserve.toFixed(
              2,
            )} (10% of NAV)`,
        );
      }

      // WARN: If dropping below target but above minimum
      const reserveRatioAfter = (reserveAfter / (targetReserve / 0.1)) * 10000; // Calculate new ratio
      const isLowReserve = reserveRatioAfter < RESERVE_RATIO_BPS;

      if (isLowReserve) {
        this.logger.warn(
          `Allocation will drop reserves below 10% target: ` +
            `${reserveRatioAfter} bps (${(reserveRatioAfter / 100).toFixed(2)}%)`,
        );
      }

      // Build transaction for OPERATOR wallet
      const data = stableYieldManager.interface.encodeFunctionData('allocateToSPV', [
        dto.poolAddress,
        dto.spvAddress,
        amountWei,
      ]);

      const addresses = CONTRACT_ADDRESSES[chainId];

      // Create SPV operation record
      const operation = await this.prisma.sPVOperation.create({
        data: {
          poolId: pool.id,
          operationType: 'WITHDRAW_FOR_INVESTMENT',
          amount: dto.amount,
          status: 'PENDING',
          initiatedBy: dto.spvAddress,
          notes: `Allocate ${dto.amount} ${
            pool.assetSymbol
          } to SPV (Reserve after: ${reserveAfter.toFixed(2)})`,
        },
      });

      // Update pool status to PENDING_INVESTMENT
      await this.prisma.pool.update({
        where: { id: pool.id },
        data: { status: 'PENDING_INVESTMENT' },
      });

      this.logger.log(
        `Funds allocated to SPV: ${dto.amount} ${pool.assetSymbol} from ${pool.name}. ` +
          `Reserve: ${currentReserve.toFixed(2)} → ${reserveAfter.toFixed(2)} (${(
            reserveRatioAfter / 100
          ).toFixed(2)}%)`,
      );

      return {
        operation: {
          id: operation.id,
          status: operation.status,
          amount: operation.amount.toString(),
        },
        transaction: {
          to: addresses.stableYieldManager,
          data,
          value: '0',
          description: `Allocate ${dto.amount} ${pool.assetSymbol} to SPV`,
        },
        reserveInfo: {
          currentReserve: currentReserve.toFixed(2),
          afterAllocation: reserveAfter.toFixed(2),
          targetReserve: targetReserve.toFixed(2),
          minRequired: minAcceptableReserve.toFixed(2),
          currentRatio: `${(reserveRatio / 100).toFixed(2)}%`,
          afterRatio: `${(reserveRatioAfter / 100).toFixed(2)}%`,
          isLowReserve,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to allocate to SPV: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to validate reserves: ${error.message}`);
    }
  }

  /**
   * Rebalance pool reserves to maintain target ratio
   * OPERATOR_ROLE only
   * Coordinates with SPV to liquidate instruments or invest excess cash
   */
  async rebalancePoolReserves(dto: RebalancePoolReservesDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    // Validate: Only Stable Yield pools
    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Only Stable Yield pools support rebalancing');
    }

    // Validate action
    if (dto.action !== 0 && dto.action !== 1) {
      throw new BadRequestException('Action must be 0 (liquidate) or 1 (invest)');
    }

    const amount = parseFloat(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
      const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
      const decimals = await assetContract.decimals();
      const amountWei = ethers.parseUnits(dto.amount, decimals);

      // Query reserve status
      const reserveStatus = await stableYieldManager.getReserveStatus(pool.poolAddress);

      const currentReserve = Number(ethers.formatUnits(reserveStatus.currentReserve, decimals));
      const targetReserve = Number(ethers.formatUnits(reserveStatus.targetReserve, decimals));
      const rebalanceNeeded = reserveStatus.rebalanceNeeded;

      if (!rebalanceNeeded) {
        throw new BadRequestException(
          `Pool reserves are balanced (within 8-12% range). ` +
            `Current: ${(Number(reserveStatus.reserveRatio) / 100).toFixed(2)}%, Target: 10%`,
        );
      }

      // Validate action makes sense
      if (dto.action === 0) {
        // Liquidate: need more cash
        if (currentReserve >= targetReserve) {
          throw new BadRequestException(
            `Cannot liquidate: reserves (${currentReserve.toFixed(
              2,
            )}) already meet target (${targetReserve.toFixed(2)})`,
          );
        }
      } else {
        // Invest: too much cash
        if (currentReserve <= targetReserve) {
          throw new BadRequestException(
            `Cannot invest: reserves (${currentReserve.toFixed(
              2,
            )}) below target (${targetReserve.toFixed(2)})`,
          );
        }
      }

      // Build transaction
      const data = stableYieldManager.interface.encodeFunctionData('rebalancePoolReserves', [
        dto.poolAddress,
        dto.action,
        amountWei,
      ]);

      const addresses = CONTRACT_ADDRESSES[chainId];

      const actionName = dto.action === 0 ? 'liquidate' : 'invest';
      this.logger.log(`Rebalancing ${pool.name}: ${actionName} ${dto.amount} ${pool.assetSymbol}`);

      return {
        transaction: {
          to: addresses.stableYieldManager,
          data,
          value: '0',
          description:
            dto.action === 0
              ? `Liquidate ${dto.amount} ${pool.assetSymbol} to increase reserves`
              : `Invest ${dto.amount} ${pool.assetSymbol} excess reserves`,
        },
        reserveStatus: {
          current: currentReserve.toFixed(2),
          target: targetReserve.toFixed(2),
          ratio: `${(Number(reserveStatus.reserveRatio) / 100).toFixed(2)}%`,
          action: actionName,
          amount: dto.amount,
        },
        nextSteps:
          dto.action === 1
            ? ['After transaction confirms, call allocateToSPV to send funds to SPV']
            : ['SPV should mature instruments to return liquidity to pool'],
      };
    } catch (error) {
      this.logger.error(`Failed to rebalance reserves: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to rebalance: ${error.message}`);
    }
  }

  // ========== ENHANCED POOL DETAIL (ADMIN DASHBOARD) ==========

  /**
   * Get comprehensive pool detail for Admin
   * This is the main dashboard for admin to monitor and manage a pool
   */
  async getAdminPoolDetail(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
          orderBy: { maturityDate: 'asc' },
        },
        withdrawalRequests: {
          where: { status: 'QUEUED' },
          orderBy: { requestTime: 'asc' },
        },
        spvOperations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    // For Stable Yield pools, get reserve status
    let reserveInfo = null;
    if (pool.poolType === 'STABLE_YIELD') {
      try {
        const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
        const reserveStatus = await stableYieldManager.getReserveStatus(pool.poolAddress);

        const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
        const decimals = await assetContract.decimals();

        const currentReserve = Number(ethers.formatUnits(reserveStatus.currentReserve, decimals));
        const targetReserve = Number(ethers.formatUnits(reserveStatus.targetReserve, decimals));
        const reserveRatio = Number(reserveStatus.reserveRatio) / 100;
        const needsRebalance = reserveStatus.rebalanceNeeded;

        let recommendedAction = null;
        if (needsRebalance) {
          if (currentReserve > targetReserve * 1.2) {
            recommendedAction = {
              action: 'allocate_to_spv',
              amount: (currentReserve - targetReserve).toFixed(2),
              reason: 'Excess reserves above 12%',
              urgency: 'medium',
            };
          } else if (currentReserve < targetReserve * 0.8) {
            recommendedAction = {
              action: 'rebalance_liquidate',
              amount: (targetReserve - currentReserve).toFixed(2),
              reason: 'Insufficient reserves below 8%',
              urgency: 'high',
            };
          }
        }

        const lastRebalance = await this.prisma.sPVOperation.findFirst({
          where: {
            poolId: pool.id,
            operationType: 'WITHDRAW_FOR_INVESTMENT',
          },
          orderBy: { createdAt: 'desc' },
        });

        reserveInfo = {
          current: currentReserve.toFixed(2),
          target: targetReserve.toFixed(2),
          currentRatio: reserveRatio.toFixed(2),
          targetRatio: '10.00',
          needsRebalance,
          recommendedAction,
          lastRebalance: lastRebalance?.createdAt || null,
        };
      } catch (error) {
        this.logger.error(`Failed to fetch reserve status: ${error.message}`);
      }
    }

    // Calculate health score
    const healthFactors = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Factor 1: Reserve Ratio (30% weight) - Stable Yield only
    if (pool.poolType === 'STABLE_YIELD' && reserveInfo) {
      const reserveRatio = parseFloat(reserveInfo.currentRatio);
      let reserveScore = 0;
      let reserveStatus = 'healthy';

      if (reserveRatio < 8) {
        reserveScore = 40;
        reserveStatus = 'critical';
      } else if (reserveRatio < 9) {
        reserveScore = 70;
        reserveStatus = 'warning';
      } else if (reserveRatio > 12) {
        reserveScore = 80;
        reserveStatus = 'warning';
      } else if (reserveRatio >= 9 && reserveRatio <= 11) {
        reserveScore = 100;
        reserveStatus = 'excellent';
      } else {
        reserveScore = 90;
        reserveStatus = 'healthy';
      }

      healthFactors.push({
        name: 'Reserve Ratio',
        status: reserveStatus,
        value: `${reserveRatio.toFixed(2)}%`,
        target: '10%',
        score: reserveScore,
        weight: 30,
      });

      totalScore += reserveScore * 30;
      totalWeight += 30;
    }

    // Factor 2: Withdrawal Queue (25% weight)
    const withdrawalCount = pool.withdrawalRequests.length;
    let withdrawalScore = 0;
    let withdrawalStatus = 'healthy';

    if (withdrawalCount === 0) {
      withdrawalScore = 100;
      withdrawalStatus = 'excellent';
    } else if (withdrawalCount <= 3) {
      withdrawalScore = 90;
      withdrawalStatus = 'healthy';
    } else if (withdrawalCount <= 10) {
      withdrawalScore = 70;
      withdrawalStatus = 'warning';
    } else {
      withdrawalScore = 40;
      withdrawalStatus = 'critical';
    }

    healthFactors.push({
      name: 'Withdrawal Queue',
      status: withdrawalStatus,
      value: `${withdrawalCount} pending`,
      target: '< 5',
      score: withdrawalScore,
      weight: 25,
    });

    totalScore += withdrawalScore * 25;
    totalWeight += 25;

    // Factor 3: NAV Update Frequency (15% weight) - Stable Yield only
    if (pool.poolType === 'STABLE_YIELD') {
      const lastNAVUpdate = await this.prisma.nAVHistory.findFirst({
        where: { poolId: pool.id },
        orderBy: { timestamp: 'desc' },
      });

      const daysSinceUpdate = lastNAVUpdate
        ? Math.floor((Date.now() - lastNAVUpdate.timestamp.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let navScore = 0;
      let navStatus = 'healthy';

      if (daysSinceUpdate > 7) {
        navScore = 40;
        navStatus = 'critical';
      } else if (daysSinceUpdate > 5) {
        navScore = 70;
        navStatus = 'warning';
      } else if (daysSinceUpdate <= 2) {
        navScore = 100;
        navStatus = 'excellent';
      } else {
        navScore = 85;
        navStatus = 'healthy';
      }

      healthFactors.push({
        name: 'NAV Update Frequency',
        status: navStatus,
        value: daysSinceUpdate === 999 ? 'Never' : `${daysSinceUpdate} days ago`,
        target: '< 3 days',
        score: navScore,
        weight: 15,
      });

      totalScore += navScore * 15;
      totalWeight += 15;
    }

    // Factor 4: SPV/Investment Performance (20% weight)
    let performanceScore = 85; // Default
    let performanceStatus = 'healthy';
    const currentAPY = Number(pool.analytics?.apy || pool.projectedAPY || 0);
    const targetAPY = Number(pool.projectedAPY || 0);

    if (pool.poolType === 'STABLE_YIELD') {
      if (currentAPY >= targetAPY) {
        performanceScore = 100;
        performanceStatus = 'excellent';
      } else if (currentAPY >= targetAPY * 0.9) {
        performanceScore = 85;
        performanceStatus = 'healthy';
      } else if (currentAPY >= targetAPY * 0.7) {
        performanceScore = 70;
        performanceStatus = 'warning';
      } else {
        performanceScore = 50;
        performanceStatus = 'critical';
      }

      healthFactors.push({
        name: 'Investment Performance',
        status: performanceStatus,
        value: `${currentAPY.toFixed(2)}% yield`,
        target: `> ${targetAPY.toFixed(2)}%`,
        score: performanceScore,
        weight: 20,
      });

      totalScore += performanceScore * 20;
      totalWeight += 20;
    }

    // Factor 5: User Activity (10% weight)
    const activeInvestors = pool.analytics?.uniqueInvestors || 0;
    let activityScore = 0;
    let activityStatus = 'healthy';

    if (activeInvestors >= 50) {
      activityScore = 100;
      activityStatus = 'excellent';
    } else if (activeInvestors >= 20) {
      activityScore = 85;
      activityStatus = 'healthy';
    } else if (activeInvestors >= 10) {
      activityScore = 70;
      activityStatus = 'warning';
    } else {
      activityScore = 60;
      activityStatus = 'healthy';
    }

    healthFactors.push({
      name: 'User Activity',
      status: activityStatus,
      value: `${activeInvestors} active investors`,
      target: 'growth',
      score: activityScore,
      weight: 10,
    });

    totalScore += activityScore * 10;
    totalWeight += 10;

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    let overallStatus = 'healthy';

    if (overallScore >= 90) {
      overallStatus = 'excellent';
    } else if (overallScore >= 75) {
      overallStatus = 'healthy';
    } else if (overallScore >= 60) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'critical';
    }

    // SPV Performance (for Stable Yield)
    let spvPerformance = null;
    if (pool.poolType === 'STABLE_YIELD' && pool.spvAddress) {
      const operations = await this.prisma.sPVOperation.findMany({
        where: { poolId: pool.id },
        orderBy: { createdAt: 'desc' },
      });

      const completedOps = operations.filter((op) => op.status === 'COMPLETED');
      const totalOps = operations.length;
      const successRate = totalOps > 0 ? ((completedOps.length / totalOps) * 100).toFixed(0) : '0';

      const lastActivity = operations[0]?.createdAt || null;

      spvPerformance = {
        assignedSPV: pool.spvAddress,
        instrumentsManaged: pool.instruments.length,
        totalAUM: pool.instruments
          .reduce((sum: number, inst: any) => sum + Number(inst.purchasePrice), 0)
          .toFixed(2),
        averageYield: currentAPY.toFixed(2),
        successRate: `${successRate}%`,
        lastActivity,
        responsiveness:
          lastActivity && Date.now() - lastActivity.getTime() < 7 * 24 * 60 * 60 * 1000
            ? 'excellent'
            : 'warning',
        totalOperations: totalOps,
        issues: [],
      };
    }

    // Available admin actions
    const availableActions = [];

    if (pool.poolType === 'STABLE_YIELD' && reserveInfo?.recommendedAction) {
      availableActions.push({
        action: reserveInfo.recommendedAction.action,
        enabled: true,
        reason: reserveInfo.recommendedAction.reason,
        endpoint:
          reserveInfo.recommendedAction.action === 'allocate_to_spv'
            ? `/api/v1/admin/pools/${pool.poolAddress}/allocate-to-spv`
            : `/api/v1/admin/pools/${pool.poolAddress}/rebalance-reserves`,
        requiresInput: ['amount'],
      });
    }

    if (pool.withdrawalRequests.length > 0) {
      const processableCount = pool.withdrawalRequests.filter((req: any) => {
        // Simple check - in reality would need to check reserves
        return true;
      }).length;

      availableActions.push({
        action: 'PROCESS_WITHDRAWAL_QUEUE',
        enabled: processableCount > 0,
        reason: `${processableCount} withdrawal(s) can be processed`,
        endpoint: '/api/v1/admin/withdrawal-queues/:id/process',
        requiresInput: ['queueId'],
      });
    }

    availableActions.push({
      action: 'UPDATE_POOL_METADATA',
      enabled: true,
      reason: 'Update pool information',
      endpoint: `/api/v1/admin/pools/${pool.poolAddress}/metadata`,
      requiresInput: ['metadata'],
    });

    if (pool.status !== 'CANCELLED' && pool.status !== 'MATURED') {
      availableActions.push({
        action: 'CLOSE_POOL',
        enabled: true,
        reason: 'Initiate orderly wind-down',
        endpoint: `/api/v1/admin/pools/${pool.poolAddress}/close`,
        requiresInput: [],
      });
    }

    return {
      pool: {
        address: pool.poolAddress,
        name: pool.name,
        description: pool.description,
        type: pool.poolType,
        status: pool.status,
        assetSymbol: pool.assetSymbol,
        totalValueLocked: pool.analytics?.totalValueLocked || '0',
        totalShares: pool.analytics?.totalShares || '0',
        navPerShare: pool.analytics?.navPerShare || '1.0',
        projectedAPY: pool.projectedAPY?.toString() || '0',
        activeInvestors: pool.analytics?.uniqueInvestors || 0,
        createdAt: pool.createdAt,
        assignedSPV: pool.spvAddress,
        maturityDate: pool.maturityDate,
        epochEndTime: pool.epochEndTime,
      },
      health: {
        overall: overallStatus,
        score: overallScore,
        factors: healthFactors,
      },
      reserves: reserveInfo,
      spvPerformance,
      withdrawalQueue: {
        pending: pool.withdrawalRequests.map((req: any) => ({
          id: req.id,
          userAddress: req.userId, // Would need to join User to get wallet
          shares: req.shares.toString(),
          assetValue: req.estimatedValue.toString(),
          requestedAt: req.requestTime,
          waitingDays: Math.floor((Date.now() - req.requestTime.getTime()) / (1000 * 60 * 60 * 24)),
          priority: 'normal',
          canProcessNow: true, // TODO: Check against reserves
          blockedReason: null,
        })),
        summary: {
          totalPending: pool.withdrawalRequests.length,
          totalValue: pool.withdrawalRequests
            .reduce((sum: number, req: any) => sum + Number(req.estimatedValue), 0)
            .toFixed(2),
          canProcessCount: pool.withdrawalRequests.length, // TODO: Calculate based on reserves
          blockedCount: 0,
          oldestRequest: pool.withdrawalRequests[0]?.requestTime || null,
        },
      },
      operations: {
        recent: pool.spvOperations.map((op: any) => ({
          id: op.id,
          type: op.operationType,
          status: op.status,
          amount: op.amount?.toString() || '0',
          initiatedBy: op.initiatedBy,
          timestamp: op.createdAt,
          notes: op.notes,
        })),
        stats: {
          last30Days: {
            totalOperations: pool.spvOperations.filter(
              (op: any) => Date.now() - op.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000,
            ).length,
          },
        },
      },
      financials: {
        tvl: pool.analytics?.totalValueLocked || '0',
        invested: pool.instruments
          .reduce((sum: number, inst: any) => sum + Number(inst.purchasePrice), 0)
          .toFixed(2),
        reserves: reserveInfo?.current || '0',
        unrealizedGains: pool.instruments
          .reduce(
            (sum: number, inst: any) => Number(inst.faceValue) - Number(inst.purchasePrice) + sum,
            0,
          )
          .toFixed(2),
      },
      availableActions,
    };
  }

  // ========== POOL SOFT CLOSE ==========

  /**
   * Soft close a pool (orderly wind-down)
   * No new deposits, but existing operations continue
   */
  async closePool(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.status === 'CANCELLED' || pool.status === 'MATURED') {
      throw new BadRequestException(`Pool is already ${pool.status.toLowerCase()}`);
    }

    // Update pool status to CANCELLED (using existing enum value)
    await this.prisma.pool.update({
      where: { id: pool.id },
      data: {
        status: 'CANCELLED',
        isActive: false,
      },
    });

    this.logger.log(`Pool ${pool.name} (${pool.poolAddress}) has been closed`);

    return {
      success: true,
      poolAddress: pool.poolAddress,
      poolName: pool.name,
      previousStatus: pool.status,
      newStatus: 'CANCELLED',
      message:
        'Pool closed successfully. No new deposits allowed. Existing positions can be withdrawn.',
      nextSteps: [
        'For Stable Yield: SPV should mature all instruments',
        'Process all pending withdrawal requests',
        'Users can withdraw remaining funds',
      ],
    };
  }
}
