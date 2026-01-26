import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolBuilderService } from '../../blockchain/pool-builder.service';
import { PoolCreationWatcher } from '../../blockchain/pool-creation-watcher.service';
import { PoolCreationValidator } from './validators/pool-creation.validator';
import {
  CreatePoolDto,
  ConfirmPoolDeploymentDto,
  UpdateLockTierDto,
  AddLockTierDto,
} from './dtos/create-pool.dto';
import {
  PausePoolDto,
  ApproveAssetDto,
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
import { CONTRACT_ADDRESSES } from '../../contracts/addresses';

// Contract constants matching StableYieldManager
const RESERVE_RATIO_BPS = 1000; // 10% - hardcoded in contract

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
    await this.poolValidator.validate(dto, chainId);

    // Clean up any old pending pools with empty addresses (failed/cancelled deployments)
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

    const assetContract = this.blockchain.getERC20(chainId, dto.asset);
    const [assetSymbol, assetDecimals] = await Promise.all([
      assetContract.symbol(),
      assetContract.decimals(),
    ]);

    // Store pool metadata in database with PENDING_DEPLOYMENT status
    const pool = await this.prisma.pool.create({
      data: {
        chainId,
        poolAddress: '',
        poolType: dto.poolType,
        name: dto.name,
        description: dto.description,
        managerAddress: '',
        escrowAddress: '',
        assetAddress: dto.asset.toLowerCase(),
        assetSymbol,
        assetDecimals: Number(assetDecimals),
        minInvestment: dto.minInvestment,
        targetRaise: dto.targetRaise,
        epochEndTime: dto.epochEndTime ? new Date(dto.epochEndTime) : null,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : null,
        discountRate: dto.discountRate,
        instrumentType: dto.instrumentType,
        // Single-Asset specific fields
        withdrawalFeeBps: dto.withdrawalFeeBps,
        minimumFundingThreshold: dto.minimumFundingThreshold,
        couponDates: dto.couponDates || [],
        couponRates: dto.couponRates || [],
        // SPV address (Stable Yield & Locked)
        spvAddress: dto.spvAddress,
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
      symbol: dto.symbol,
      spvAddress: dto.spvAddress,
      // Single-Asset specific
      couponDates: dto.couponDates,
      couponRates: dto.couponRates,
      minimumFundingThreshold: dto.minimumFundingThreshold,
      withdrawalFeeBps: dto.withdrawalFeeBps,
      // Locked pool specific
      initialTiers: dto.initialTiers?.map((tier) => ({
        durationDays: tier.durationDays,
        apyBps: tier.apyBps,
        earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
        minDeposit: tier.minDeposit,
        isActive: tier.isActive ?? true,
      })),
    });

    this.logger.log(`Transaction data generated for pool ${pool.id}`);

    // Return full pool details for frontend
    return {
      poolId: pool.id,
      pool: {
        id: pool.id,
        chainId: pool.chainId,
        poolAddress: pool.poolAddress,
        poolType: pool.poolType,
        status: pool.status,

        name: pool.name,
        description: pool.description,
        issuer: pool.issuer,
        issuerLogo: pool.issuerLogo,
        country: pool.country,
        region: pool.region,
        riskRating: pool.riskRating,
        securityType: pool.securityType,
        tags: pool.tags,

        assetAddress: pool.assetAddress,
        assetSymbol,
        assetDecimals: Number(assetDecimals),

        minInvestment: pool.minInvestment,
        targetRaise: pool.targetRaise,
        epochEndTime: pool.epochEndTime,
        maturityDate: pool.maturityDate,
        discountRate: pool.discountRate,
        instrumentType: pool.instrumentType,
        spvAddress: pool.spvAddress,

        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt,
        createdOnChain: pool.createdOnChain, // Will be updated by watcher

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

    // Treasury & Fee Metrics from pool analytics
    const treasuryAgg = await this.prisma.treasuryTransaction.aggregate({
      _sum: { amount: true },
      where: { type: { in: ['FEE_COLLECTION', 'PENALTY_COLLECTION', 'PROTOCOL_REVENUE'] } },
    });

    const penaltiesAgg = await this.prisma.poolAnalytics.aggregate({
      _sum: { totalPenaltiesCollected: true },
    });

    const treasuryMetrics = {
      totalCollected: treasuryAgg._sum.amount?.toString() || '0',
      totalPenalties: penaltiesAgg._sum.totalPenaltiesCollected?.toString() || '0',
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

  async getActivityLog(page = 1, limit = 20, filter?: string) {
    const skip = (page - 1) * limit;

    // Filter by category if provided
    const categoryFilters: Record<string, string[]> = {
      pools: ['createPool', 'closeEpoch', 'cancelPool', 'pausePool', 'unpausePool', 'updateAPY'],
      roles: ['grantRole', 'revokeRole', 'updateRole'],
      assets: ['approveAsset', 'revokeAsset', 'addAsset'],
      emergency: ['emergencyPause', 'emergencyUnpause', 'forceCloseEpoch'],
    };

    const whereClause =
      filter && categoryFilters[filter] ? { action: { in: categoryFilters[filter] } } : {};

    const [activities, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: whereClause,
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
      this.prisma.auditLog.count({ where: whereClause }),
    ]);

    // Enhance activities with target, poolName, and category
    const enhancedActivities = await Promise.all(
      activities.map(async (activity) => {
        let poolName: string | null = null;
        let target: string | null = activity.entity;
        let category: string = 'other';

        // Determine category based on action
        for (const [cat, actions] of Object.entries(categoryFilters)) {
          if (actions.includes(activity.action)) {
            category = cat;
            break;
          }
        }

        // If entity looks like a pool address, try to get pool name
        if (activity.entityId && /^0x[a-fA-F0-9]{40}$/.test(activity.entityId)) {
          const pool = await this.prisma.pool.findFirst({
            where: { poolAddress: activity.entityId.toLowerCase() },
            select: { name: true },
          });
          if (pool) {
            poolName = pool.name;
            target = pool.name;
          }
        }

        return {
          ...activity,
          target,
          poolName,
          category,
        };
      }),
    );

    return {
      activities: enhancedActivities,
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
   * Note: With FeeManager removed, fees are now handled per-pool via managers
   */
  async getTreasuryOverview(chainId = 84532) {
    // Get recent treasury transactions from database
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
        if (
          tx.type === 'FEE_COLLECTION' ||
          tx.type === 'PROTOCOL_REVENUE' ||
          tx.type === 'PENALTY_COLLECTION'
        ) {
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

    // Get pool-level fee stats
    const poolAnalytics = await this.prisma.poolAnalytics.aggregate({
      _sum: {
        totalPenaltiesCollected: true,
        totalInterestPaid: true,
      },
    });

    return {
      summary: {
        totalCollected: totalCollected.toString(),
        totalWithdrawn: totalWithdrawn.toString(),
        totalPenaltiesCollected: poolAnalytics._sum.totalPenaltiesCollected?.toString() || '0',
      },
      byAsset: totalsByAsset,
      recentTransactions: recentTransactions.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
      note: 'Fees are now managed per-pool via StableYieldManager and LockedPoolManager',
    };
  }

  /**
   * Withdraw from treasury (via SPV or direct pool withdrawal)
   * Note: With FeeManager removed, withdrawals happen at pool level
   */
  async withdrawTreasury(dto: WithdrawTreasuryDto, chainId = 84532) {
    // Record the withdrawal intent
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

    this.logger.log(`Treasury withdrawal recorded: ${dto.amount} ${dto.asset} to ${dto.recipient}`);

    return {
      success: true,
      message:
        'Treasury withdrawal recorded. With FeeManager removed, withdrawals happen at individual pool level via SPV operations.',
      amount: dto.amount,
      asset: dto.asset,
      recipient: dto.recipient,
      note: 'Use allocateToSPV or pool-specific withdrawal functions',
    };
  }

  // ========== FEE MANAGEMENT ==========

  /**
   * Get fee configuration and stats
   * Fees are now managed per-pool via StableYieldManager
   */
  async getFees(chainId = 84532) {
    // Get fee config from StableYieldManager
    let defaultTransactionFee = 0;
    try {
      const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
      const defaultFeeBps = await stableYieldManager.defaultTransactionFeeBps();
      defaultTransactionFee = Number(defaultFeeBps);
    } catch (error) {
      this.logger.warn(`Could not fetch fee config: ${error.message}`);
    }

    // Get all active pools with escrow addresses
    const pools = await this.prisma.pool.findMany({
      where: { chainId, isActive: true },
      select: {
        id: true,
        name: true,
        poolAddress: true,
        poolType: true,
        escrowAddress: true,
        assetDecimals: true,
      },
    });

    // Query on-chain fee data from escrow contracts
    const poolFeeData: Array<{
      poolId: string;
      poolName: string;
      poolAddress: string;
      poolType: string;
      accruedFees: string; // Unclaimed
      totalFeesCollected: string; // Claimed
      totalFees: string; // Total lifetime
      feeBps: number;
      decimals: number;
    }> = [];

    let totalAccruedFees = 0;
    let totalCollectedFees = 0;

    for (const pool of pools) {
      if (pool.poolType === 'STABLE_YIELD') {
        // Auto-fetch escrow address if missing
        const escrowAddr = pool.escrowAddress || (await this.ensureEscrowAddress(pool, chainId));

        if (escrowAddr) {
          try {
            const escrow = this.blockchain.getStableYieldEscrow(chainId, escrowAddr);
            const stableYieldManager = this.blockchain.getStableYieldManager(chainId);

            const [accruedFees, totalFees, feeBps] = await Promise.all([
              escrow.getAccruedFees(),
              escrow.getTotalFeesCollected(), // This is total (claimed + unclaimed)
              stableYieldManager.getPoolTransactionFee(pool.poolAddress),
            ]);

            const decimals = pool.assetDecimals;
            const accruedNum = Number(accruedFees) / 10 ** decimals; // Unclaimed
            const totalNum = Number(totalFees) / 10 ** decimals; // Total (claimed + unclaimed)
            const collectedNum = totalNum - accruedNum; // Claimed = total - unclaimed

            totalAccruedFees += accruedNum;
            totalCollectedFees += collectedNum;

            poolFeeData.push({
              poolId: pool.id,
              poolName: pool.name,
              poolAddress: pool.poolAddress,
              poolType: pool.poolType,
              accruedFees: accruedNum.toFixed(2), // Unclaimed/pending
              totalFeesCollected: collectedNum.toFixed(2), // Actually claimed
              totalFees: totalNum.toFixed(2), // Total lifetime fees
              feeBps: Number(feeBps),
              decimals,
            });
          } catch (error) {
            this.logger.warn(`Could not fetch fees for pool ${pool.name}: ${error.message}`);
          }
        }
      }
      // TODO: Add LOCKED pool fee tracking when fee manager is added
    }

    // Get fee collection history from DB
    const feeTransactions = await this.prisma.treasuryTransaction.findMany({
      where: {
        type: { in: ['FEE_COLLECTION', 'PENALTY_COLLECTION'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate fees by pool type
    const feesByType: Record<
      string,
      { accruedFees: number; collectedFees: number; poolCount: number }
    > = {
      STABLE_YIELD: { accruedFees: 0, collectedFees: 0, poolCount: 0 },
      LOCKED: { accruedFees: 0, collectedFees: 0, poolCount: 0 },
      SINGLE_ASSET: { accruedFees: 0, collectedFees: 0, poolCount: 0 },
    };

    for (const data of poolFeeData) {
      const type = data.poolType;
      if (feesByType[type]) {
        feesByType[type].accruedFees += parseFloat(data.accruedFees);
        feesByType[type].collectedFees += parseFloat(data.totalFeesCollected);
        feesByType[type].poolCount++;
      }
    }

    const byPoolType = Object.entries(feesByType).map(([poolType, data]) => ({
      poolType,
      accruedFees: data.accruedFees.toFixed(2),
      collectedFees: data.collectedFees.toFixed(2),
      poolCount: data.poolCount,
    }));

    return {
      configuration: {
        defaultTransactionFeeBps: defaultTransactionFee,
        defaultFeePercent: (defaultTransactionFee / 100).toFixed(2) + '%',
        note: 'Fees configured per-pool via StableYieldManager.setPoolTransactionFee()',
      },
      summary: {
        totalAccruedFees: totalAccruedFees.toFixed(2),
        totalCollectedFees: totalCollectedFees.toFixed(2),
        pendingCollection: totalAccruedFees.toFixed(2),
        lastUpdated: new Date().toISOString(),
      },
      byPoolType,
      byPool: poolFeeData.map((data) => ({
        poolId: data.poolId,
        poolName: data.poolName,
        poolAddress: data.poolAddress,
        poolType: data.poolType,
        accruedFees: data.accruedFees,
        totalFeesCollected: data.totalFeesCollected,
        feeBps: data.feeBps,
        feePercent: (data.feeBps / 100).toFixed(2) + '%',
        canCollect: parseFloat(data.accruedFees) > 0,
      })),
      recentCollections: feeTransactions.map((tx) => ({
        ...tx,
        amount: tx.amount.toString(),
      })),
    };
  }

  /**
   * Collect fees from a pool's escrow to treasury
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

    if (pool.poolType === 'STABLE_YIELD') {
      // Auto-fetch escrow address if missing
      const escrowAddr = pool.escrowAddress || (await this.ensureEscrowAddress(pool, chainId));

      if (!escrowAddr) {
        throw new NotFoundException('Escrow address not found for pool');
      }

      const escrow = this.blockchain.getStableYieldEscrow(chainId, escrowAddr);

      // Get current accrued fees
      const accruedFees = await escrow.getAccruedFees();
      const accruedFeesNum = Number(accruedFees) / 10 ** pool.assetDecimals;

      if (accruedFeesNum === 0) {
        return {
          pool: {
            name: pool.name,
            address: pool.poolAddress,
            escrowAddress: escrowAddr,
            type: pool.poolType,
          },
          accruedFees: '0',
          message: 'No fees to collect',
        };
      }

      // Build transaction to transfer fees to treasury
      // Treasury address defaults to timelockController (which acts as protocol treasury)
      const treasuryAddress = addresses.treasury || addresses.timelockController;
      if (!treasuryAddress) {
        throw new Error('Treasury address not configured');
      }

      const txData = escrow.interface.encodeFunctionData('transferFeesToTreasury', [
        treasuryAddress,
      ]);

      return {
        pool: {
          name: pool.name,
          address: pool.poolAddress,
          escrowAddress: escrowAddr,
          type: pool.poolType,
        },
        accruedFees: accruedFeesNum.toFixed(2),
        treasuryAddress,
        transactionData: {
          to: escrowAddr,
          data: txData,
          value: '0',
        },
        message: `Sign this transaction to collect ${accruedFeesNum.toFixed(
          2,
        )} in fees to treasury`,
      };
    } else if (pool.poolType === 'LOCKED') {
      // For locked pools, penalties are collected on early exit automatically
      const analytics = await this.prisma.poolAnalytics.findUnique({
        where: { poolId: pool.id },
      });

      return {
        pool: {
          name: pool.name,
          address: pool.poolAddress,
          type: pool.poolType,
        },
        penaltiesCollected: analytics?.totalPenaltiesCollected?.toString() || '0',
        note: 'Locked pool fees come from early exit penalties, collected automatically.',
      };
    }

    return {
      pool: {
        name: pool.name,
        address: pool.poolAddress,
        type: pool.poolType,
      },
      note: 'Fees are managed per-pool type. Check pool-specific manager for fee details.',
    };
  }

  /**
   * Update fee configuration for a pool
   */
  async updateFeeConfig(dto: UpdateFeeConfigDto, chainId = 84532) {
    const addresses = CONTRACT_ADDRESSES[chainId];

    if (dto.poolType === 'STABLE_YIELD') {
      const stableYieldManager = this.blockchain.getStableYieldManager(chainId);

      // Build setPoolTransactionFee or setDefaultTransactionFee call
      let data: string;
      let description: string;

      if (dto.poolAddress) {
        data = stableYieldManager.interface.encodeFunctionData('setPoolTransactionFee', [
          dto.poolAddress,
          dto.rate,
        ]);
        description = `Set transaction fee to ${dto.rate / 100}% for pool ${dto.poolAddress}`;
      } else {
        data = stableYieldManager.interface.encodeFunctionData('setDefaultTransactionFee', [
          dto.rate,
        ]);
        description = `Set default transaction fee to ${dto.rate / 100}%`;
      }

      this.logger.log(description);

      return {
        transaction: {
          to: addresses.stableYieldManager,
          data,
          value: '0',
          description,
        },
      };
    } else if (dto.poolType === 'LOCKED') {
      // Locked pool fees are early exit penalties, configured per-tier
      return {
        message: 'Locked pool fees are configured via tier early exit penalties.',
        note: 'Use PATCH /admin/locked-pools/:address/tiers/:index to update earlyExitPenaltyBps',
      };
    }

    throw new BadRequestException(`Fee configuration not supported for pool type: ${dto.poolType}`);
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
          lockedPoolManager: { address: addresses.lockedPoolManager },
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
   * Fetch and update escrow address from registry if missing
   */
  private async ensureEscrowAddress(
    pool: { id: string; poolAddress: string; poolType: string; escrowAddress: string | null },
    chainId: number,
  ): Promise<string | null> {
    // If escrow address already exists, return it
    if (pool.escrowAddress) {
      return pool.escrowAddress;
    }

    // Only Stable Yield pools have escrow
    if (pool.poolType !== 'STABLE_YIELD') {
      return null;
    }

    try {
      const registry = this.blockchain.getPoolRegistry(chainId);
      const poolData = await registry.getStableYieldPoolData(pool.poolAddress);

      if (poolData.escrowAddress && poolData.escrowAddress !== ethers.ZeroAddress) {
        // Update the database with the escrow address
        await this.prisma.pool.update({
          where: { id: pool.id },
          data: { escrowAddress: poolData.escrowAddress.toLowerCase() },
        });

        this.logger.log(
          `📝 Updated escrow address for pool ${pool.poolAddress}: ${poolData.escrowAddress}`,
        );
        return poolData.escrowAddress.toLowerCase();
      }
    } catch (error) {
      this.logger.warn(`Could not fetch escrow address from registry: ${error.message}`);
    }

    return null;
  }

  /**
   * Get comprehensive pool detail for Admin
   * This is the main dashboard for admin to monitor and manage a pool
   */
  async getAdminPoolDetail(poolAddress: string, chainId = 84532) {
    let pool = await this.prisma.pool.findFirst({
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

    // Ensure escrow address is populated for Stable Yield pools
    const escrowAddress = await this.ensureEscrowAddress(pool, chainId);
    if (escrowAddress && !pool.escrowAddress) {
      pool = { ...pool, escrowAddress };
    }

    // Get live TVL from on-chain based on pool type
    let liveTVL = '0';
    let tvlBreakdown: Record<string, string> = {};
    let escrowData: {
      poolReserves: string;
      cashBuffer: string;
      accruedFees: string; // Unclaimed fees
      claimedFees: string; // Already collected
      totalFees: string; // Total lifetime (claimed + unclaimed)
      totalBalance: string;
    } | null = null;

    try {
      const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
      const decimals = await assetContract.decimals();

      const { tvl, breakdown } = await this.blockchain.getPoolTVL(
        chainId,
        pool.poolAddress,
        pool.poolType as 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED',
      );
      liveTVL = ethers.formatUnits(tvl, decimals);

      if (breakdown) {
        for (const [key, value] of Object.entries(breakdown)) {
          tvlBreakdown[key] = ethers.formatUnits(value, decimals);
        }
      }

      // For Stable Yield pools, also get escrow data
      if (pool.poolType === 'STABLE_YIELD' && pool.escrowAddress) {
        const escrow = await this.blockchain.getEscrowData(chainId, pool.escrowAddress);
        const accruedFeesNum = ethers.formatUnits(escrow.accruedFees, decimals);
        const totalFeesNum = ethers.formatUnits(escrow.totalFeesCollected, decimals); // Total = claimed + unclaimed
        const claimedFeesNum = (parseFloat(totalFeesNum) - parseFloat(accruedFeesNum)).toFixed(
          decimals > 6 ? 6 : decimals,
        );

        escrowData = {
          poolReserves: ethers.formatUnits(escrow.poolReserves, decimals),
          cashBuffer: ethers.formatUnits(escrow.cashBuffer, decimals),
          accruedFees: accruedFeesNum, // Unclaimed fees
          claimedFees: claimedFeesNum, // Claimed = total - unclaimed
          totalFees: totalFeesNum, // Total lifetime fees
          totalBalance: ethers.formatUnits(escrow.totalBalance, decimals),
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch live TVL: ${error.message}`);
      liveTVL = pool.analytics?.totalValueLocked?.toString() || '0';
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
        totalValueLocked: liveTVL, // Live from chain
        totalValueLockedCached: pool.analytics?.totalValueLocked || '0', // From DB
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
      escrow: escrowData, // Escrow data for Stable Yield pools
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
        tvl: liveTVL, // Live TVL from chain
        tvlBreakdown, // Breakdown per pool type
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
      fees: escrowData
        ? {
            unclaimed: escrowData.accruedFees, // Pending collection
            claimed: escrowData.claimedFees, // Already collected to treasury
            total: escrowData.totalFees, // Lifetime total (claimed + unclaimed)
            totalFromPool: pool.analytics?.totalPenaltiesCollected?.toString() || '0',
          }
        : {
            unclaimed: '0',
            claimed: '0',
            total: '0',
            totalFromPool: pool.analytics?.totalPenaltiesCollected?.toString() || '0',
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

  // ========== LOCKED POOL MANAGEMENT ==========

  /**
   * Get locked pool details including tiers and position statistics
   */
  async getLockedPoolDetail(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
        lockTiers: {
          orderBy: { tierIndex: 'asc' },
        },
        lockedPositions: {
          where: { status: { in: ['ACTIVE', 'MATURED'] } },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      throw new BadRequestException('Pool is not a Locked pool');
    }

    // Calculate per-tier statistics
    const tierStats = pool.lockTiers.map((tier) => {
      const tierPositions = pool.lockedPositions.filter((pos) => pos.tierId === tier.id);
      const activeCount = tierPositions.filter((p) => p.status === 'ACTIVE').length;
      const maturedCount = tierPositions.filter((p) => p.status === 'MATURED').length;
      const totalPrincipal = tierPositions.reduce((sum, p) => sum + Number(p.principal), 0);

      return {
        tier: {
          id: tier.id,
          tierIndex: tier.tierIndex,
          durationDays: tier.durationDays,
          apyBps: tier.apyBps,
          apyPercent: (tier.apyBps / 100).toFixed(2),
          earlyExitPenaltyBps: tier.earlyExitPenaltyBps,
          earlyExitPenaltyPercent: (tier.earlyExitPenaltyBps / 100).toFixed(2),
          minDeposit: tier.minDeposit.toString(),
          isActive: tier.isActive,
        },
        stats: {
          activePositions: activeCount,
          maturedPositions: maturedCount,
          totalPositions: tierPositions.length,
          totalPrincipal: totalPrincipal.toFixed(2),
        },
      };
    });

    // Get positions maturing soon (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const maturingSoon = pool.lockedPositions.filter(
      (p) => p.status === 'ACTIVE' && p.lockEndTime <= sevenDaysFromNow,
    );

    return {
      pool: {
        id: pool.id,
        address: pool.poolAddress,
        name: pool.name,
        description: pool.description,
        status: pool.status,
        assetSymbol: pool.assetSymbol,
        spvAddress: pool.spvAddress,
      },
      analytics: {
        totalValueLocked: pool.analytics?.totalValueLocked?.toString() || '0',
        totalPrincipalLocked: pool.analytics?.totalPrincipalLocked?.toString() || '0',
        totalInterestPaid: pool.analytics?.totalInterestPaid?.toString() || '0',
        totalPenaltiesCollected: pool.analytics?.totalPenaltiesCollected?.toString() || '0',
        activePositions: pool.analytics?.activePositions || 0,
        uniqueInvestors: pool.analytics?.uniqueInvestors || 0,
      },
      tiers: tierStats,
      alerts: {
        maturingSoon: maturingSoon.length,
        maturingSoonValue: maturingSoon
          .reduce((sum, p) => sum + Number(p.expectedMaturityPayout), 0)
          .toFixed(2),
      },
    };
  }

  /**
   * Update a lock tier's configuration
   * Note: Cannot change durationDays after creation
   */
  async updateLockTier(
    poolAddress: string,
    tierIndex: number,
    dto: UpdateLockTierDto,
    chainId = 84532,
  ) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        lockTiers: { where: { tierIndex } },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      throw new BadRequestException('Pool is not a Locked pool');
    }

    const tier = pool.lockTiers[0];
    if (!tier) {
      throw new NotFoundException(`Tier ${tierIndex} not found`);
    }

    // Update in database
    const updatedTier = await this.prisma.lockTier.update({
      where: { id: tier.id },
      data: {
        ...(dto.apyBps !== undefined && { apyBps: dto.apyBps }),
        ...(dto.earlyExitPenaltyBps !== undefined && {
          earlyExitPenaltyBps: dto.earlyExitPenaltyBps,
        }),
        ...(dto.minDeposit !== undefined && {
          minDeposit: parseFloat(dto.minDeposit),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Build transaction to update on-chain
    // Note: This requires LockedPoolManager.updateTier() function
    const lockedPoolManager = this.blockchain.getLockedPoolManager(chainId);
    const addresses = CONTRACT_ADDRESSES[chainId];

    // Build tier update transaction data
    const tierConfig = {
      durationDays: tier.durationDays,
      apyBps: dto.apyBps ?? tier.apyBps,
      earlyExitPenaltyBps: dto.earlyExitPenaltyBps ?? tier.earlyExitPenaltyBps,
      minDeposit: dto.minDeposit
        ? ethers.parseUnits(dto.minDeposit, pool.assetDecimals)
        : ethers.parseUnits(tier.minDeposit.toString(), pool.assetDecimals),
      isActive: dto.isActive ?? tier.isActive,
    };

    const data = lockedPoolManager.interface.encodeFunctionData('configureTier', [
      pool.poolAddress,
      tierIndex,
      tierConfig,
    ]);

    this.logger.log(
      `Lock tier ${tierIndex} updated for pool ${pool.name}: APY=${tierConfig.apyBps}bps`,
    );

    return {
      tier: {
        id: updatedTier.id,
        tierIndex: updatedTier.tierIndex,
        durationDays: updatedTier.durationDays,
        apyBps: updatedTier.apyBps,
        earlyExitPenaltyBps: updatedTier.earlyExitPenaltyBps,
        minDeposit: updatedTier.minDeposit.toString(),
        isActive: updatedTier.isActive,
      },
      transaction: {
        to: addresses.lockedPoolManager,
        data,
        value: '0',
        description: `Update tier ${tierIndex} for ${pool.name}`,
      },
    };
  }

  /**
   * Add a new lock tier to an existing locked pool
   */
  async addLockTier(poolAddress: string, dto: AddLockTierDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        lockTiers: {
          orderBy: { tierIndex: 'desc' },
          take: 1,
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      throw new BadRequestException('Pool is not a Locked pool');
    }

    // Get next tier index
    const nextTierIndex = (pool.lockTiers[0]?.tierIndex ?? -1) + 1;

    // Create in database
    const newTier = await this.prisma.lockTier.create({
      data: {
        poolId: pool.id,
        tierIndex: nextTierIndex,
        durationDays: dto.durationDays,
        apyBps: dto.apyBps,
        earlyExitPenaltyBps: dto.earlyExitPenaltyBps,
        minDeposit: parseFloat(dto.minDeposit),
        isActive: dto.isActive ?? true,
      },
    });

    // Build transaction to add on-chain
    const lockedPoolManager = this.blockchain.getLockedPoolManager(chainId);
    const addresses = CONTRACT_ADDRESSES[chainId];

    const tierConfig = {
      durationDays: dto.durationDays,
      apyBps: dto.apyBps,
      earlyExitPenaltyBps: dto.earlyExitPenaltyBps,
      minDeposit: ethers.parseUnits(dto.minDeposit, pool.assetDecimals),
      isActive: dto.isActive ?? true,
    };

    const data = lockedPoolManager.interface.encodeFunctionData('addTier', [
      pool.poolAddress,
      tierConfig,
    ]);

    this.logger.log(
      `New lock tier added to pool ${pool.name}: ${dto.durationDays} days @ ${
        dto.apyBps / 100
      }% APY`,
    );

    return {
      tier: {
        id: newTier.id,
        tierIndex: newTier.tierIndex,
        durationDays: newTier.durationDays,
        apyBps: newTier.apyBps,
        earlyExitPenaltyBps: newTier.earlyExitPenaltyBps,
        minDeposit: newTier.minDeposit.toString(),
        isActive: newTier.isActive,
      },
      transaction: {
        to: addresses.lockedPoolManager,
        data,
        value: '0',
        description: `Add new ${dto.durationDays}-day tier to ${pool.name}`,
      },
    };
  }

  /**
   * Get all locked positions for a pool (admin view)
   */
  async getLockedPoolPositions(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'LOCKED') {
      throw new BadRequestException('Pool is not a Locked pool');
    }

    const positions = await this.prisma.lockedPosition.findMany({
      where: { poolId: pool.id },
      include: {
        tier: true,
        user: {
          select: {
            walletAddress: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { lockEndTime: 'asc' }],
    });

    const now = Date.now();

    return {
      pool: {
        id: pool.id,
        name: pool.name,
        poolAddress: pool.poolAddress,
      },
      summary: {
        total: positions.length,
        active: positions.filter((p) => p.status === 'ACTIVE').length,
        matured: positions.filter((p) => p.status === 'MATURED').length,
        redeemed: positions.filter((p) => p.status === 'REDEEMED').length,
        earlyExited: positions.filter((p) => p.status === 'EARLY_EXIT').length,
        rolledOver: positions.filter((p) => p.status === 'ROLLED_OVER').length,
        totalPrincipal: positions
          .filter((p) => p.status === 'ACTIVE')
          .reduce((sum, p) => sum + Number(p.principal), 0)
          .toFixed(2),
      },
      positions: positions.map((pos) => ({
        positionId: pos.positionId,
        userAddress: pos.user.walletAddress,
        userEmail: pos.user.email,
        tier: {
          tierIndex: pos.tier.tierIndex,
          durationDays: pos.tier.durationDays,
          apyBps: pos.tier.apyBps,
        },
        principal: pos.principal.toString(),
        investedAmount: pos.investedAmount.toString(),
        interest: pos.interest.toString(),
        interestPayment: pos.interestPayment,
        expectedMaturityPayout: pos.expectedMaturityPayout.toString(),
        depositTime: pos.depositTime,
        lockEndTime: pos.lockEndTime,
        status: pos.status,
        autoRollover: pos.autoRollover,
        daysRemaining: Math.max(
          0,
          Math.ceil((pos.lockEndTime.getTime() - now) / (1000 * 60 * 60 * 24)),
        ),
        actualPayout: pos.actualPayout?.toString() || null,
        penaltyPaid: pos.penaltyPaid?.toString() || null,
      })),
    };
  }

  // ============================================================================
  // SYSTEM ALERTS
  // ============================================================================

  /**
   * Get system alerts based on pool states and upcoming events
   * GET /api/v1/admin/alerts
   */
  async getAlerts() {
    const alerts: any[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. Single-Asset pools approaching epoch end (within 7 days)
    const epochClosingPools = await this.prisma.pool.findMany({
      where: {
        poolType: 'SINGLE_ASSET',
        status: 'FUNDING',
        isActive: true,
        epochEndTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    for (const pool of epochClosingPools) {
      const daysRemaining = Math.ceil(
        (pool.epochEndTime!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      alerts.push({
        id: `epoch-${pool.id}`,
        type: 'epoch_closing',
        severity: daysRemaining <= 2 ? 'critical' : 'warning',
        message: `Pool "${pool.name}" epoch ends in ${daysRemaining} day(s)`,
        timestamp: now.toISOString(),
        poolId: pool.id,
        poolName: pool.name,
        poolAddress: pool.poolAddress,
        actionLabel: 'Review & Close',
        actionEndpoint: `/api/v1/admin/pools/${pool.poolAddress}/close-epoch`,
        daysRemaining,
      });
    }

    // 2. Single-Asset pools that are fully funded
    const filledPools = await this.prisma.pool.findMany({
      where: {
        poolType: 'SINGLE_ASSET',
        status: 'FUNDING',
        isActive: true,
      },
      include: {
        analytics: true,
      },
    });

    for (const pool of filledPools) {
      if (pool.targetRaise && pool.analytics) {
        const tvl = Number(pool.analytics.totalValueLocked);
        const target = Number(pool.targetRaise);
        if (tvl >= target) {
          alerts.push({
            id: `filled-${pool.id}`,
            type: 'pool_filled',
            severity: 'info',
            message: `Pool "${pool.name}" has reached target raise of ${target}`,
            timestamp: now.toISOString(),
            poolId: pool.id,
            poolName: pool.name,
            poolAddress: pool.poolAddress,
            actionLabel: 'Close Early',
            actionEndpoint: `/api/v1/admin/pools/${pool.poolAddress}/close-epoch`,
          });
        }
      }
    }

    // 3. Stable Yield pools needing APY update (approaching end of month)
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (daysInMonth - dayOfMonth <= 3) {
      const stableYieldPools = await this.prisma.pool.findMany({
        where: {
          poolType: 'STABLE_YIELD',
          isActive: true,
          status: { not: 'CANCELLED' },
        },
      });

      for (const pool of stableYieldPools) {
        alerts.push({
          id: `apy-${pool.id}`,
          type: 'apy_update',
          severity: 'warning',
          message: `Monthly APY review due for "${pool.name}"`,
          timestamp: now.toISOString(),
          poolId: pool.id,
          poolName: pool.name,
          poolAddress: pool.poolAddress,
          actionLabel: 'Update APY',
          daysRemaining: daysInMonth - dayOfMonth,
        });
      }
    }

    // 4. Locked positions maturing soon (within 7 days)
    const maturingPositions = await this.prisma.lockedPosition.findMany({
      where: {
        status: 'ACTIVE',
        lockEndTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        pool: true,
      },
    });

    // Group by pool
    const maturingByPool = maturingPositions.reduce((acc, pos) => {
      const key = pos.poolId;
      if (!acc[key]) {
        acc[key] = { pool: pos.pool, count: 0, totalPrincipal: 0 };
      }
      acc[key].count++;
      acc[key].totalPrincipal += Number(pos.principal);
      return acc;
    }, {} as Record<string, any>);

    for (const [, data] of Object.entries(maturingByPool)) {
      alerts.push({
        id: `maturity-${data.pool.id}`,
        type: 'positions_maturing',
        severity: 'info',
        message: `${data.count} position(s) maturing in pool "${
          data.pool.name
        }" (${data.totalPrincipal.toFixed(2)} total)`,
        timestamp: now.toISOString(),
        poolId: data.pool.id,
        poolName: data.pool.name,
        poolAddress: data.pool.poolAddress,
        metadata: {
          positionCount: data.count,
          totalPrincipal: data.totalPrincipal,
        },
      });
    }

    // 5. Paused pools
    const pausedPools = await this.prisma.pool.findMany({
      where: { isPaused: true },
    });

    for (const pool of pausedPools) {
      alerts.push({
        id: `paused-${pool.id}`,
        type: 'pool_paused',
        severity: 'critical',
        message: `Pool "${pool.name}" is paused`,
        timestamp: now.toISOString(),
        poolId: pool.id,
        poolName: pool.name,
        poolAddress: pool.poolAddress,
        actionLabel: 'Unpause',
        actionEndpoint: `/api/v1/admin/pools/${pool.poolAddress}/unpause`,
      });
    }

    // Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

    return {
      alerts,
      summary: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
        total: alerts.length,
      },
    };
  }

  /**
   * Acknowledge/dismiss an alert
   * POST /api/v1/admin/alerts/:alertId/acknowledge
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    // Store acknowledged alerts in a separate table or cache
    // For now, we'll just log it
    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`);
    return { success: true, alertId };
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  /**
   * Get all role assignments
   * GET /api/v1/admin/roles
   */
  async getRoles() {
    const users = await this.prisma.user.findMany({
      where: {
        userType: { not: 'REGULAR_USER' },
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        userType: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map user types to roles
    const roles = users.map((user) => ({
      id: user.id,
      address: user.walletAddress,
      role: user.userType,
      grantedAt: user.createdAt.toISOString(),
      isActive: user.isActive,
    }));

    return {
      roles,
      summary: {
        totalAdmins: users.filter((u) => u.userType === 'ADMIN').length,
        totalOperators: users.filter((u) => u.userType === 'OPERATOR').length,
        totalSPVManagers: users.filter((u) => u.userType === 'SPV_MANAGER').length,
        totalVerifiers: users.filter((u) => u.userType === 'VERIFIER').length,
        total: users.length,
      },
    };
  }

  /**
   * Build transaction to grant role on-chain via AccessManager
   * POST /api/v1/admin/roles/grant
   */
  async grantRole(dto: { address: string; role: string }, chainId = 84532) {
    const accessManager = this.blockchain.getAccessManager(chainId);
    const addresses = CONTRACT_ADDRESSES[chainId];

    // Map role name to on-chain role ID
    // These should match AccessManager role definitions
    const roleMap: Record<string, bigint> = {
      ADMIN: 0n, // DEFAULT_ADMIN_ROLE
      OPERATOR: 1n,
      SPV_MANAGER: 2n,
      VERIFIER: 3n,
      SUPER_ADMIN: 0n, // Same as ADMIN
    };

    const roleId = roleMap[dto.role.toUpperCase()];
    if (roleId === undefined) {
      throw new BadRequestException(`Unknown role: ${dto.role}`);
    }

    const data = accessManager.interface.encodeFunctionData('grantRole', [
      roleId,
      dto.address,
      0, // executionDelay
    ]);

    return {
      transaction: {
        to: addresses.accessManager,
        data,
        value: '0',
        description: `Grant ${dto.role} role to ${dto.address}`,
      },
      role: {
        address: dto.address,
        role: dto.role,
        status: 'pending',
      },
    };
  }

  /**
   * Build transaction to revoke role on-chain via AccessManager
   * POST /api/v1/admin/roles/revoke
   */
  async revokeRole(dto: { address: string; role: string }, chainId = 84532) {
    const accessManager = this.blockchain.getAccessManager(chainId);
    const addresses = CONTRACT_ADDRESSES[chainId];

    const roleMap: Record<string, bigint> = {
      ADMIN: 0n,
      OPERATOR: 1n,
      SPV_MANAGER: 2n,
      VERIFIER: 3n,
      SUPER_ADMIN: 0n,
    };

    const roleId = roleMap[dto.role.toUpperCase()];
    if (roleId === undefined) {
      throw new BadRequestException(`Unknown role: ${dto.role}`);
    }

    const data = accessManager.interface.encodeFunctionData('revokeRole', [roleId, dto.address]);

    return {
      transaction: {
        to: addresses.accessManager,
        data,
        value: '0',
        description: `Revoke ${dto.role} role from ${dto.address}`,
      },
    };
  }

  // ============================================================================
  // PAUSED POOLS
  // ============================================================================

  /**
   * Get all paused pools
   * GET /api/v1/admin/pools/paused
   */
  async getPausedPools() {
    const pools = await this.prisma.pool.findMany({
      where: { isPaused: true },
      select: {
        id: true,
        name: true,
        poolAddress: true,
        poolType: true,
        updatedAt: true,
      },
    });

    return {
      pools: pools.map((pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        poolAddress: pool.poolAddress,
        poolType: pool.poolType,
        pausedAt: pool.updatedAt.toISOString(),
      })),
    };
  }

  // ============================================================================
  // KNOWN ADDRESSES
  // ============================================================================

  /**
   * Get mapping of known addresses to friendly names
   * GET /api/v1/admin/addresses/known
   */
  async getKnownAddresses(chainId = 84532) {
    const addresses: Record<string, { name: string; type: string; description?: string }> = {};
    const contractAddresses = CONTRACT_ADDRESSES[chainId];

    // Add contract addresses
    addresses[contractAddresses.accessManager.toLowerCase()] = {
      name: 'Access Manager',
      type: 'contract',
      description: 'Role-based access control',
    };
    addresses[contractAddresses.poolRegistry.toLowerCase()] = {
      name: 'Pool Registry',
      type: 'contract',
      description: 'Pool registration and tracking',
    };
    addresses[contractAddresses.poolFactory.toLowerCase()] = {
      name: 'Pool Factory',
      type: 'contract',
      description: 'Single-Asset pool factory',
    };
    addresses[contractAddresses.manager.toLowerCase()] = {
      name: 'Manager',
      type: 'contract',
      description: 'Single-Asset pool manager',
    };
    addresses[contractAddresses.stableYieldManager.toLowerCase()] = {
      name: 'Stable Yield Manager',
      type: 'contract',
      description: 'Stable Yield pool manager',
    };
    addresses[contractAddresses.managedPoolFactory.toLowerCase()] = {
      name: 'Managed Pool Factory',
      type: 'contract',
      description: 'Stable Yield & Locked pool factory',
    };
    addresses[contractAddresses.lockedPoolManager.toLowerCase()] = {
      name: 'Locked Pool Manager',
      type: 'contract',
      description: 'Locked pool manager',
    };

    // Add known user addresses (admins, SPVs, etc.)
    const knownUsers = await this.prisma.user.findMany({
      where: {
        userType: { not: 'REGULAR_USER' },
      },
      select: {
        walletAddress: true,
        email: true,
        userType: true,
      },
    });

    for (const user of knownUsers) {
      addresses[user.walletAddress.toLowerCase()] = {
        name: user.email || `${user.userType} User`,
        type: user.userType.toLowerCase(),
      };
    }

    // Add SPV addresses from pools
    const spvPools = await this.prisma.pool.findMany({
      where: {
        spvAddress: { not: null },
      },
      select: {
        name: true,
        spvAddress: true,
      },
    });

    for (const pool of spvPools) {
      if (pool.spvAddress && !addresses[pool.spvAddress.toLowerCase()]) {
        addresses[pool.spvAddress.toLowerCase()] = {
          name: `SPV for ${pool.name}`,
          type: 'spv',
        };
      }
    }

    return { addresses };
  }
}
