import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { AllocateToSPVDto, AddInstrumentDto, MatureInstrumentDto } from './dtos/spv-operations.dto';
import { WithdrawFundsDto, ConfirmInvestmentDto } from './dtos/spv-investment.dto';
import { RecordCouponDto, CouponScheduleQueryDto } from './dtos/spv-coupon.dto';
import { BatchMatureDto } from './dtos/spv-batch.dto';
import { TriggerNAVUpdateDto } from './dtos/spv-nav.dto';
import { InstrumentsQueryDto } from './dtos/spv-instruments.dto';
import { SetInvestmentThresholdDto, GetAlertsQueryDto } from './dtos/spv-preferences.dto';
import { ethers } from 'ethers';
import StableYieldManagerABI from '../../contracts/abis/StableYieldManager.json';
import { CONTRACT_ADDRESSES } from '../../contracts/addresses';
import { OperationStatus } from '@prisma/client';

@Injectable()
export class SpvService {
  private readonly logger = new Logger(SpvService.name);

  constructor(private prisma: PrismaService, private blockchain: BlockchainService) {}

  /**
   * Check if user can access SPV operations for this pool
   * Returns true if:
   * 1. User is the assigned SPV for the pool, OR
   * 2. User has DEFAULT_ADMIN_ROLE (as default admin is granted all roles including SPV)
   */
  private async canAccessPool(spvAddress: string, pool: any, chainId: number): Promise<boolean> {
    // Check if SPV is assigned to this pool
    const poolSpvLower = pool.spvAddress?.toLowerCase();
    const inputSpvLower = spvAddress.toLowerCase();

    this.logger.debug(`Checking SPV access: Pool SPV=${poolSpvLower}, Input SPV=${inputSpvLower}`);

    if (poolSpvLower === inputSpvLower) {
      this.logger.debug('SPV matched - access granted');
      return true;
    }

    // Check if user has DEFAULT_ADMIN_ROLE (as fallback)
    try {
      const accessManager = this.blockchain.getAccessManager(chainId);
      const DEFAULT_ADMIN_ROLE =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const isAdmin = await accessManager.hasRole(DEFAULT_ADMIN_ROLE, spvAddress);

      if (isAdmin) {
        this.logger.debug('User has DEFAULT_ADMIN_ROLE - access granted');
      } else {
        this.logger.debug('User does not have DEFAULT_ADMIN_ROLE');
      }

      return isAdmin;
    } catch (error) {
      this.logger.warn(`Error checking admin role: ${error.message}`);
      return false;
    }
  }

  // ❌ REMOVED: allocateToSPV moved to admin.service.ts
  // Reason: Contract requires OPERATOR_ROLE, not SPV_ROLE
  // Use: POST /admin/pools/:poolAddress/allocate-to-spv instead

  async addInstrument(dto: AddInstrumentDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
    const decimals = await assetContract.decimals();

    const purchasePriceWei = ethers.parseUnits(dto.purchasePrice, decimals);
    const faceValueWei = ethers.parseUnits(dto.faceValue, decimals);
    const maturityTimestamp = Math.floor(new Date(dto.maturityDate).getTime() / 1000);

    const data = stableYieldManager.interface.encodeFunctionData('addInstrument', [
      dto.poolAddress,
      dto.instrumentType === 'DISCOUNTED' ? 0 : 1,
      purchasePriceWei,
      faceValueWei,
      maturityTimestamp,
      dto.annualCouponRate || 0,
      dto.couponFrequency || 0,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    const instrumentCount = await this.prisma.instrument.count({
      where: { poolId: pool.id },
    });

    await this.prisma.instrument.create({
      data: {
        poolId: pool.id,
        instrumentId: instrumentCount + 1,
        instrumentType: dto.instrumentType,
        purchasePrice: dto.purchasePrice,
        faceValue: dto.faceValue,
        purchaseDate: new Date(),
        maturityDate: new Date(dto.maturityDate),
        annualCouponRate: dto.annualCouponRate,
        couponFrequency: dto.couponFrequency,
        isActive: true,
      },
    });

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Add ${dto.instrumentType} instrument to ${pool.name}`,
      },
    };
  }

  async matureInstrument(dto: MatureInstrumentDto, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: dto.poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    const instrument = await this.prisma.instrument.findUnique({
      where: { id: dto.instrumentId },
    });

    if (!instrument || instrument.poolId !== pool.id) {
      throw new NotFoundException('Instrument not found');
    }

    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);

    const data = stableYieldManager.interface.encodeFunctionData('matureInstrument', [
      dto.poolAddress,
      dto.instrumentId,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    await this.prisma.instrument.update({
      where: { id: dto.instrumentId },
      data: {
        isActive: false,
        maturedAt: new Date(),
      },
    });

    return {
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Mature instrument in ${pool.name}`,
      },
    };
  }

  async getPoolInstruments(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        instruments: {
          orderBy: { maturityDate: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return {
      poolAddress: pool.poolAddress,
      poolName: pool.name,
      instruments: pool.instruments,
      summary: {
        total: pool.instruments.length,
        active: pool.instruments.filter((i) => i.isActive).length,
        matured: pool.instruments.filter((i) => !i.isActive && i.maturedAt).length,
      },
    };
  }

  async getOperations(page = 1, limit = 20, statusFilter?: string) {
    const skip = (page - 1) * limit;

    const where = statusFilter ? { status: statusFilter as OperationStatus } : {};

    const [operations, total] = await Promise.all([
      this.prisma.sPVOperation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: 'desc' },
        include: {
          pool: {
            select: {
              poolAddress: true,
              name: true,
              assetSymbol: true,
            },
          },
        },
      }),
      this.prisma.sPVOperation.count({ where }),
    ]);

    return {
      operations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAnalyticsOverview() {
    const [totalOperations, pendingOperations, totalInstruments, upcomingMaturities] =
      await Promise.all([
        this.prisma.sPVOperation.count(),
        this.prisma.sPVOperation.count({ where: { status: 'PENDING' } }),
        this.prisma.instrument.count({ where: { isActive: true } }),
        this.prisma.instrument.findMany({
          where: {
            isActive: true,
            maturityDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { maturityDate: 'asc' },
          take: 10,
          include: {
            pool: {
              select: {
                name: true,
                poolAddress: true,
                assetSymbol: true,
              },
            },
          },
        }),
      ]);

    const totalAllocated = await this.prisma.sPVOperation.aggregate({
      where: { operationType: 'WITHDRAW_FOR_INVESTMENT', status: 'COMPLETED' },
      _sum: { amount: true },
    });

    return {
      overview: {
        totalOperations,
        pendingOperations,
        totalInstruments,
        totalAllocated: totalAllocated._sum?.amount?.toString() || '0',
      },
      upcomingMaturities,
    };
  }

  async getMaturities(days = 90) {
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const maturities = await this.prisma.instrument.findMany({
      where: {
        isActive: true,
        maturityDate: {
          gte: new Date(),
          lte: endDate,
        },
      },
      orderBy: { maturityDate: 'asc' },
      include: {
        pool: {
          select: {
            name: true,
            poolAddress: true,
            assetSymbol: true,
          },
        },
      },
    });

    const groupedByMonth = maturities.reduce((acc: any, instrument) => {
      const month = instrument.maturityDate.toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(instrument);
      return acc;
    }, {});

    const totalValue = maturities.reduce((sum, i) => sum + parseFloat(i.faceValue.toString()), 0);

    return {
      maturities,
      groupedByMonth,
      summary: {
        total: maturities.length,
        totalValue: totalValue.toString(),
      },
    };
  }

  async getPools(includeInactive = false) {
    const pools = await this.prisma.pool.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pools;
  }

  async getPoolById(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
        instruments: {
          orderBy: { maturityDate: 'asc' },
        },
        spvOperations: {
          take: 20,
          orderBy: { initiatedAt: 'desc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    return pool;
  }

  // ========== PHASE 1: INVESTMENT FLOW ==========

  /**
   * Get pools pending SPV investment
   * Only applies to STABLE_YIELD pools in FILLED/PENDING_INVESTMENT status
   */
  async getPendingInvestments(chainId = 84532) {
    const pools = await this.prisma.pool.findMany({
      where: {
        poolType: 'STABLE_YIELD', // Only Stable Yield pools have SPV management
        status: { in: ['FILLED', 'PENDING_INVESTMENT'] },
        isActive: true,
        chainId,
      },
      include: {
        analytics: {
          select: { totalValueLocked: true },
        },
        spvOperations: {
          where: {
            operationType: 'WITHDRAW_FOR_INVESTMENT',
          },
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    });

    const pendingInvestments = pools
      .filter((pool) => {
        // Check if there's no pending/approved withdrawal
        const hasActiveWithdrawal = pool.spvOperations.some(
          (op) => op.status === 'PENDING' || op.status === 'APPROVED',
        );
        return !hasActiveWithdrawal;
      })
      .map((pool) => {
        const tvl = Number(pool.analytics?.totalValueLocked || 0);
        const lastWithdrawal = pool.spvOperations[0];
        const alreadyWithdrawn =
          lastWithdrawal?.status === 'COMPLETED' ? Number(lastWithdrawal.amount) : 0;

        const availableForInvestment = tvl - alreadyWithdrawn;

        // Calculate deadline (epoch end + 30 days)
        const deadline = pool.epochEndTime
          ? new Date(pool.epochEndTime.getTime() + 30 * 24 * 60 * 60 * 1000)
          : null;

        const daysRemaining = deadline
          ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          poolId: pool.id,
          poolName: pool.name,
          poolAddress: pool.poolAddress,
          status: pool.status,
          availableForInvestment: availableForInvestment.toString(),
          totalValueLocked: tvl.toString(),
          deadline,
          daysRemaining,
          lastWithdrawal: lastWithdrawal || null,
          isUrgent: daysRemaining !== null && daysRemaining < 7,
        };
      })
      .filter((p) => Number(p.availableForInvestment) > 0);

    const totalAmount = pendingInvestments.reduce(
      (sum, p) => sum + Number(p.availableForInvestment),
      0,
    );

    const urgent = pendingInvestments.filter((p) => p.isUrgent).length;

    return {
      pendingInvestments,
      summary: {
        totalPools: pendingInvestments.length,
        totalAmount: totalAmount.toString(),
        urgent,
      },
    };
  }

  /**
   * Withdraw funds from escrow for SPV investment
   * Enhanced version of allocateToSPV with better validation
   */
  async withdrawFunds(dto: WithdrawFundsDto, chainId = 84532) {
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

    // Validate: Pool must be in correct status
    if (!['FILLED', 'PENDING_INVESTMENT'].includes(pool.status)) {
      throw new BadRequestException(`Cannot withdraw funds from pool with status: ${pool.status}`);
    }

    // Validate: Check available balance
    const tvl = Number(pool.analytics?.totalValueLocked || 0);
    const requestedAmount = parseFloat(dto.amount);

    if (requestedAmount > tvl) {
      throw new BadRequestException(
        `Requested amount (${dto.amount}) exceeds available TVL (${tvl})`,
      );
    }

    // Build transaction
    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
    const decimals = await assetContract.decimals();
    const amountWei = ethers.parseUnits(dto.amount, decimals);

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
        notes: dto.notes || `Withdraw ${dto.amount} ${pool.assetSymbol} for investment`,
      },
    });

    // Update pool status to PENDING_INVESTMENT
    await this.prisma.pool.update({
      where: { id: pool.id },
      data: { status: 'PENDING_INVESTMENT' },
    });

    this.logger.log(
      `Funds withdrawal initiated: ${dto.amount} ${pool.assetSymbol} from ${pool.name}`,
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
        description: `Withdraw ${dto.amount} ${pool.assetSymbol} to SPV`,
      },
    };
  }

  /**
   * Confirm off-chain investment completed
   */
  async confirmInvestment(dto: ConfirmInvestmentDto, chainId = 84532) {
    const operation = await this.prisma.sPVOperation.findUnique({
      where: { id: dto.spvOperationId },
      include: {
        pool: true,
      },
    });

    if (!operation) {
      throw new NotFoundException('SPV operation not found');
    }

    if (operation.status !== 'PENDING' && operation.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot confirm operation with status: ${operation.status}`);
    }

    // Update operation
    await this.prisma.sPVOperation.update({
      where: { id: dto.spvOperationId },
      data: {
        status: 'COMPLETED',
        proofHash: dto.proofHash,
        completedAt: new Date(),
        notes: dto.notes || operation.notes,
      },
    });

    // Update pool status to INVESTED
    await this.prisma.pool.update({
      where: { id: operation.poolId },
      data: { status: 'INVESTED' },
    });

    this.logger.log(`Investment confirmed: ${dto.amountInvested} for ${operation.pool.name}`);

    return {
      success: true,
      operation: {
        id: operation.id,
        poolName: operation.pool.name,
        amount: operation.amount.toString(),
        status: 'COMPLETED',
      },
      pool: {
        id: operation.pool.id,
        name: operation.pool.name,
        status: 'INVESTED',
      },
    };
  }

  // ========== PHASE 2: INSTRUMENT & COUPON MANAGEMENT ==========

  /**
   * Get enhanced instruments portfolio with filters
   */
  async getInstruments(query: InstrumentsQueryDto) {
    const where: any = {};

    // Status filter
    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'matured') {
      where.isActive = false;
      where.maturedAt = { not: null };
    }

    // Pool filter
    if (query.poolId) {
      where.poolId = query.poolId;
    }

    // Type filter
    if (query.type) {
      where.instrumentType = query.type;
    }

    // Maturity range filter
    if (query.maturityRange) {
      const now = new Date();
      if (query.maturityRange === 'next30days') {
        where.maturityDate = {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        };
        where.isActive = true;
      } else if (query.maturityRange === 'next90days') {
        where.maturityDate = {
          gte: now,
          lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        };
        where.isActive = true;
      }
    }

    const instruments = await this.prisma.instrument.findMany({
      where,
      include: {
        pool: {
          select: {
            name: true,
            poolAddress: true,
            assetSymbol: true,
          },
        },
        couponPayments: {
          orderBy: { paidDate: 'desc' },
        },
      },
      orderBy:
        query.sortBy === 'maturityDate'
          ? { maturityDate: 'asc' }
          : query.sortBy === 'faceValue'
          ? { faceValue: 'desc' }
          : { createdAt: 'desc' },
    });

    // Enrich instruments with calculations
    const enrichedInstruments = instruments.map((inst) => {
      const purchasePrice = Number(inst.purchasePrice);
      const faceValue = Number(inst.faceValue);
      const expectedReturn = faceValue - purchasePrice;
      const returnPercentage = (expectedReturn / purchasePrice) * 100;

      const daysToMaturity = Math.ceil(
        (inst.maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      // Calculate expected coupons
      const daysSincePurchase = (Date.now() - inst.purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      const yearsSincePurchase = daysSincePurchase / 365.25;
      const totalCouponsExpected = inst.couponFrequency
        ? Math.floor(yearsSincePurchase * inst.couponFrequency)
        : 0;

      return {
        id: inst.id,
        instrumentId: inst.instrumentId,
        instrumentType: inst.instrumentType,
        pool: inst.pool,
        purchasePrice: inst.purchasePrice.toString(),
        faceValue: inst.faceValue.toString(),
        expectedReturn: expectedReturn.toString(),
        returnPercentage: returnPercentage.toFixed(2),
        purchaseDate: inst.purchaseDate,
        maturityDate: inst.maturityDate,
        daysToMaturity,
        status: inst.isActive ? 'active' : 'matured',
        // Interest-bearing specific
        annualCouponRate: inst.annualCouponRate,
        couponFrequency: inst.couponFrequency,
        nextCouponDueDate: inst.nextCouponDueDate,
        couponsPaid: inst.couponsPaid,
        totalCouponsExpected,
        // Metadata
        issuer: inst.issuer,
        rating: inst.rating,
        cusip: inst.cusip,
      };
    });

    // Calculate summary
    const totalFaceValue = instruments.reduce((sum, i) => sum + Number(i.faceValue), 0);
    const totalPurchasePrice = instruments.reduce((sum, i) => sum + Number(i.purchasePrice), 0);
    const expectedReturn = totalFaceValue - totalPurchasePrice;
    const averageYield = totalPurchasePrice > 0 ? (expectedReturn / totalPurchasePrice) * 100 : 0;

    return {
      instruments: enrichedInstruments,
      summary: {
        total: instruments.length,
        active: instruments.filter((i) => i.isActive).length,
        matured: instruments.filter((i) => !i.isActive && i.maturedAt).length,
        totalFaceValue: totalFaceValue.toString(),
        totalPurchasePrice: totalPurchasePrice.toString(),
        expectedReturn: expectedReturn.toString(),
        averageYield: averageYield.toFixed(2),
      },
    };
  }

  /**
   * Batch mature multiple instruments
   */
  async batchMatureInstruments(dto: BatchMatureDto, chainId = 84532) {
    if (dto.maturities.length > 50) {
      throw new BadRequestException('Cannot mature more than 50 instruments at once');
    }

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
      throw new BadRequestException('Only Stable Yield pools have instruments');
    }

    // Validate all instruments belong to this pool
    const instrumentIds = dto.maturities.map((m) => m.instrumentId);
    const instruments = await this.prisma.instrument.findMany({
      where: {
        id: { in: instrumentIds },
        poolId: pool.id,
        isActive: true,
      },
    });

    if (instruments.length !== instrumentIds.length) {
      throw new BadRequestException('Some instruments not found or already matured');
    }

    // Update all instruments
    await this.prisma.instrument.updateMany({
      where: {
        id: { in: instrumentIds },
      },
      data: {
        isActive: false,
        maturedAt: new Date(),
      },
    });

    // Note: For actual blockchain call, you'd need contract support for batch maturity
    // For now, return transaction for first instrument as example
    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    const data = stableYieldManager.interface.encodeFunctionData('matureInstrument', [
      dto.poolAddress,
      instruments[0].instrumentId,
    ]);

    const addresses = CONTRACT_ADDRESSES[chainId];

    this.logger.log(`Batch matured ${instruments.length} instruments for ${pool.name}`);

    return {
      success: true,
      matured: instruments.length,
      transaction: {
        to: addresses.stableYieldManager,
        data,
        value: '0',
        description: `Batch mature ${instruments.length} instruments in ${pool.name}`,
      },
    };
  }

  /**
   * Record coupon payment received
   */
  async recordCoupon(instrumentId: string, dto: RecordCouponDto, spvUserId: string) {
    const instrument = await this.prisma.instrument.findUnique({
      where: { id: instrumentId },
      include: {
        pool: true,
      },
    });

    if (!instrument) {
      throw new NotFoundException('Instrument not found');
    }

    if (!instrument.isActive) {
      throw new BadRequestException('Cannot record coupon for matured instrument');
    }

    if (instrument.instrumentType !== 'INTEREST_BEARING') {
      throw new BadRequestException('Only interest-bearing instruments have coupons');
    }

    // Calculate next coupon due date
    const calculateNextCouponDate = (currentDate: Date, frequency: number): Date => {
      const monthsToAdd = 12 / frequency;
      const nextDate = new Date(currentDate);
      nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
      return nextDate;
    };

    const nextCouponDate = instrument.couponFrequency
      ? calculateNextCouponDate(new Date(dto.paymentDate), instrument.couponFrequency)
      : null;

    // Create coupon payment record
    const couponPayment = await this.prisma.couponPayment.create({
      data: {
        poolId: instrument.poolId,
        instrumentId: instrument.id,
        amount: dto.amount,
        couponNumber: instrument.couponsPaid + 1,
        dueDate: instrument.nextCouponDueDate || new Date(),
        paidDate: new Date(dto.paymentDate),
        receivedBy: spvUserId,
        proofHash: dto.proofHash,
        distributionStatus: 'RECEIVED',
      },
    });

    // Update instrument
    await this.prisma.instrument.update({
      where: { id: instrumentId },
      data: {
        couponsPaid: { increment: 1 },
        nextCouponDueDate: nextCouponDate,
      },
    });

    this.logger.log(`Coupon recorded for instrument ${instrument.instrumentId}: ${dto.amount}`);

    return {
      success: true,
      couponPayment: {
        id: couponPayment.id,
        couponNumber: couponPayment.couponNumber,
        amount: couponPayment.amount.toString(),
        paidDate: couponPayment.paidDate,
      },
      instrument: {
        id: instrument.id,
        couponsPaid: instrument.couponsPaid + 1,
        nextCouponDueDate: nextCouponDate,
      },
    };
  }

  /**
   * Get coupon payment schedule
   */
  async getCouponSchedule(query: CouponScheduleQueryDto) {
    const where: any = {
      instrumentType: 'INTEREST_BEARING',
      isActive: true,
    };

    if (query.poolId) {
      where.poolId = query.poolId;
    }

    // Date range filter
    if (query.range) {
      const now = new Date();
      if (query.range === 'next30days') {
        where.nextCouponDueDate = {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        };
      } else if (query.range === 'next90days') {
        where.nextCouponDueDate = {
          gte: now,
          lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        };
      }
    }

    const instruments = await this.prisma.instrument.findMany({
      where,
      include: {
        pool: {
          select: {
            name: true,
            poolAddress: true,
            assetSymbol: true,
          },
        },
        couponPayments: {
          orderBy: { paidDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { nextCouponDueDate: 'asc' },
    });

    const schedule = instruments
      .filter((inst) => inst.nextCouponDueDate)
      .map((inst) => {
        const dueDate = inst.nextCouponDueDate!;
        const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        // Calculate expected coupon amount (annualRate * faceValue / frequency)
        const expectedAmount = inst.annualCouponRate
          ? ((inst.annualCouponRate / 10000) * Number(inst.faceValue)) / (inst.couponFrequency || 1)
          : 0;

        const lastPayment = inst.couponPayments[0];
        const status = daysUntilDue < 0 ? 'overdue' : lastPayment ? 'received' : 'due';

        return {
          instrument: {
            id: inst.id,
            instrumentId: inst.instrumentId,
            type: inst.instrumentType,
            pool: inst.pool,
          },
          couponNumber: inst.couponsPaid + 1,
          dueDate,
          expectedAmount: expectedAmount.toString(),
          status,
          daysUntilDue,
          receivedAmount: lastPayment?.amount.toString(),
          receivedDate: lastPayment?.paidDate,
        };
      });

    // Apply status filter
    const filteredSchedule = query.status
      ? schedule.filter((s) => s.status === query.status)
      : schedule;

    const totalAmount = filteredSchedule.reduce((sum, s) => sum + parseFloat(s.expectedAmount), 0);

    return {
      schedule: filteredSchedule,
      summary: {
        totalDue: filteredSchedule.filter((s) => s.status === 'due').length,
        totalAmount: totalAmount.toString(),
        overdue: filteredSchedule.filter((s) => s.status === 'overdue').length,
        received: filteredSchedule.filter((s) => s.status === 'received').length,
      },
    };
  }

  // ========== PHASE 3: NAV & LIQUIDITY ==========

  /**
   * Trigger manual NAV update
   */
  async triggerNAVUpdate(
    poolAddress: string,
    dto: TriggerNAVUpdateDto,
    spvUserId: string,
    chainId = 84532,
  ) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Only Stable Yield pools have NAV');
    }

    try {
      // Get current NAV from contract
      const poolContract = this.blockchain.getPool(chainId, poolAddress, true);
      const [navPerShare, totalAssets, totalShares] = await Promise.all([
        poolContract.getNAVPerShare(),
        poolContract.totalAssets(),
        poolContract.totalSupply(),
      ]);

      // Store in NAV history
      const navHistory = await this.prisma.nAVHistory.create({
        data: {
          poolId: pool.id,
          navPerShare: ethers.formatUnits(navPerShare, pool.assetDecimals),
          totalNAV: ethers.formatUnits(totalAssets, pool.assetDecimals),
          totalShares: ethers.formatUnits(totalShares, pool.assetDecimals),
          cashReserves: '0', // TODO: Get from escrow
          instrumentValue: '0', // TODO: Calculate from instruments
          accruedFees: '0', // TODO: Calculate from fee manager
          timestamp: new Date(),
        },
      });

      // Update pool analytics
      await this.prisma.poolAnalytics.update({
        where: { poolId: pool.id },
        data: {
          navPerShare: ethers.formatUnits(navPerShare, pool.assetDecimals),
          totalValueLocked: ethers.formatUnits(totalAssets, pool.assetDecimals),
          totalShares: ethers.formatUnits(totalShares, pool.assetDecimals),
        },
      });

      this.logger.log(
        `NAV updated for ${pool.name}: ${ethers.formatUnits(navPerShare, pool.assetDecimals)}`,
      );

      return {
        success: true,
        nav: {
          navPerShare: ethers.formatUnits(navPerShare, pool.assetDecimals),
          totalAssets: ethers.formatUnits(totalAssets, pool.assetDecimals),
          totalShares: ethers.formatUnits(totalShares, pool.assetDecimals),
          timestamp: navHistory.timestamp,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update NAV for ${poolAddress}: ${error.message}`);
      throw new BadRequestException('Failed to fetch NAV from blockchain');
    }
  }

  /**
   * Get liquidity status for a pool
   */
  async getLiquidityStatus(poolAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
        },
        withdrawalRequests: {
          where: { status: 'QUEUED' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Liquidity monitoring is for Stable Yield pools');
    }

    const totalAssets = Number(pool.analytics?.totalValueLocked || 0);
    const investedAmount = pool.instruments.reduce(
      (sum, inst) => sum + Number(inst.purchasePrice),
      0,
    );
    const liquidReserve = totalAssets - investedAmount;
    const liquidityRatio = totalAssets > 0 ? (liquidReserve / totalAssets) * 100 : 0;

    const pendingWithdrawals = pool.withdrawalRequests.reduce(
      (sum, req) => sum + Number(req.shares),
      0,
    );

    // Determine status
    const status = liquidityRatio >= 20 ? 'healthy' : liquidityRatio >= 10 ? 'low' : 'critical';

    const recommendations: string[] = [];
    if (status === 'low') {
      recommendations.push('Consider processing mature instruments');
      recommendations.push('Monitor withdrawal queue closely');
    } else if (status === 'critical') {
      recommendations.push('URGENT: Process mature instruments immediately');
      recommendations.push('Consider pausing new deposits');
      recommendations.push('Prioritize instrument maturities');
    }

    return {
      poolAddress: pool.poolAddress,
      poolName: pool.name,
      totalAssets: totalAssets.toString(),
      liquidReserve: liquidReserve.toString(),
      investedAmount: investedAmount.toString(),
      liquidityRatio: liquidityRatio.toFixed(2),
      status,
      recommendations,
      withdrawalQueue: {
        count: pool.withdrawalRequests.length,
        totalAmount: pendingWithdrawals.toString(),
      },
    };
  }

  // ========== PHASE 4: ENHANCED ANALYTICS ==========

  /**
   * Get comprehensive SPV analytics (enhanced version)
   */
  async getEnhancedAnalytics() {
    const [
      stableYieldPools,
      totalInstruments,
      activeInstruments,
      pendingInvestments,
      upcomingMaturities,
      upcomingCoupons,
    ] = await Promise.all([
      this.prisma.pool.findMany({
        where: {
          poolType: 'STABLE_YIELD',
          isActive: true,
        },
        include: {
          analytics: true,
          instruments: {
            where: { isActive: true },
          },
        },
      }),
      this.prisma.instrument.count(),
      this.prisma.instrument.count({ where: { isActive: true } }),
      this.getPendingInvestments(),
      this.prisma.instrument.findMany({
        where: {
          isActive: true,
          maturityDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.instrument.findMany({
        where: {
          isActive: true,
          instrumentType: 'INTEREST_BEARING',
          nextCouponDueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate total AUM
    const totalAUM = stableYieldPools.reduce(
      (sum, pool) => sum + Number(pool.analytics?.totalValueLocked || 0),
      0,
    );

    // Calculate pending maturities value
    const pendingMaturitiesValue = upcomingMaturities.reduce(
      (sum, inst) => sum + Number(inst.faceValue),
      0,
    );

    // Calculate coupons due
    const couponsDueAmount = upcomingCoupons.reduce((sum, inst) => {
      const couponAmount = inst.annualCouponRate
        ? ((inst.annualCouponRate / 10000) * Number(inst.faceValue)) / (inst.couponFrequency || 1)
        : 0;
      return sum + couponAmount;
    }, 0);

    // Portfolio allocation
    const allInstruments = stableYieldPools.flatMap((p) => p.instruments);
    const discountedValue = allInstruments
      .filter((i) => i.instrumentType === 'DISCOUNTED')
      .reduce((sum, i) => sum + Number(i.faceValue), 0);
    const interestBearingValue = allInstruments
      .filter((i) => i.instrumentType === 'INTEREST_BEARING')
      .reduce((sum, i) => sum + Number(i.faceValue), 0);

    return {
      overview: {
        assignedPools: stableYieldPools.length,
        totalAUM: totalAUM.toString(),
        pendingInvestments: {
          count: pendingInvestments.summary.totalPools,
          totalAmount: pendingInvestments.summary.totalAmount,
        },
        totalInstruments,
        activeInstruments,
        pendingMaturities: {
          next30days: upcomingMaturities.length,
          totalValue: pendingMaturitiesValue.toString(),
        },
        couponsDue: {
          next30days: upcomingCoupons.length,
          totalAmount: couponsDueAmount.toString(),
        },
      },
      portfolioAllocation: {
        byInstrumentType: {
          DISCOUNTED: {
            count: allInstruments.filter((i) => i.instrumentType === 'DISCOUNTED').length,
            value: discountedValue.toString(),
          },
          INTEREST_BEARING: {
            count: allInstruments.filter((i) => i.instrumentType === 'INTEREST_BEARING').length,
            value: interestBearingValue.toString(),
          },
        },
        byPool: stableYieldPools
          .map((pool) => ({
            poolId: pool.id,
            poolName: pool.name,
            instrumentCount: pool.instruments.length,
            totalValue: pool.instruments
              .reduce((sum, i) => sum + Number(i.faceValue), 0)
              .toString(),
          }))
          .sort((a, b) => parseFloat(b.totalValue) - parseFloat(a.totalValue))
          .slice(0, 5),
      },
      upcomingActions: [
        ...upcomingMaturities.slice(0, 5).map((inst) => ({
          type: 'MATURITY' as const,
          dueDate: inst.maturityDate,
          amount: inst.faceValue.toString(),
          priority: 'high' as const,
        })),
        ...upcomingCoupons.slice(0, 5).map((inst) => ({
          type: 'COUPON' as const,
          dueDate: inst.nextCouponDueDate!,
          amount: (
            ((inst.annualCouponRate! / 10000) * Number(inst.faceValue)) /
            (inst.couponFrequency || 1)
          ).toString(),
          priority: 'medium' as const,
        })),
      ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    };
  }

  // ========== PHASE 5: FEE COLLECTION ==========

  /**
   * Get collectible fees (placeholder - needs FeeManager contract integration)
   */
  async getCollectibleFees() {
    const pools = await this.prisma.pool.findMany({
      where: {
        poolType: 'STABLE_YIELD',
        status: 'INVESTED',
        isActive: true,
      },
      include: {
        analytics: true,
      },
    });

    // TODO: Query actual fees from FeeManager contract
    const fees = pools.map((pool) => ({
      poolId: pool.id,
      poolName: pool.name,
      feeType: 'MANAGEMENT',
      amount: '0', // TODO: Calculate from contract
      accruedSince: pool.createdAt,
      lastCollected: null,
    }));

    return {
      fees,
      summary: {
        total: '0',
        byType: {
          MANAGEMENT: '0',
          PERFORMANCE: '0',
        },
      },
    };
  }

  /**
   * Collect fees (placeholder - needs FeeManager contract integration)
   */
  async collectFees(poolAddress: string, feeType: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    // TODO: Build actual FeeManager call
    return {
      success: true,
      message: 'Fee collection not yet implemented - needs FeeManager integration',
    };
  }

  // ========== CRITICAL MISSING: RECEIVE MATURED FUNDS ==========

  /**
   * SPV returns matured instrument proceeds to pool escrow
   * CRITICAL for revolving investment cycle
   * SPV_ROLE only
   */
  async receiveSPVMaturity(
    poolAddress: string,
    amount: string,
    spvUserId: string,
    chainId = 84532,
  ) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
      },
    });

    if (!pool) {
      throw new NotFoundException('Pool not found');
    }

    if (pool.poolType !== 'STABLE_YIELD') {
      throw new BadRequestException('Only Stable Yield pools support SPV maturity returns');
    }

    const returnAmount = parseFloat(amount);
    if (returnAmount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    try {
      const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
      const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
      const decimals = await assetContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Build transaction
      const data = stableYieldManager.interface.encodeFunctionData('receiveSPVMaturity', [
        poolAddress,
        amountWei,
      ]);

      const addresses = CONTRACT_ADDRESSES[chainId];

      // Create SPV operation record
      await this.prisma.sPVOperation.create({
        data: {
          poolId: pool.id,
          operationType: 'RECORD_MATURITY',
          amount: amount,
          status: 'PENDING',
          initiatedBy: spvUserId,
          notes: `SPV returning ${amount} ${pool.assetSymbol} matured proceeds to pool`,
        },
      });

      this.logger.log(`SPV returning matured funds: ${amount} ${pool.assetSymbol} to ${pool.name}`);

      return {
        transaction: {
          to: addresses.stableYieldManager,
          data,
          value: '0',
          description: `Return ${amount} ${pool.assetSymbol} maturity proceeds to pool`,
        },
        instructions: [
          `IMPORTANT: Before calling this transaction:`,
          `1. SPV must first transfer ${amount} ${pool.assetSymbol} to escrow via ERC20.transfer()`,
          `   - Transfer to: ${pool.escrowAddress}`,
          `   - Amount: ${amount}`,
          `2. Only AFTER transfer succeeds, execute this transaction to update accounting`,
          `3. This will trigger NAV recalculation and increase pool reserves`,
        ],
        pool: {
          name: pool.name,
          poolAddress: pool.poolAddress,
          escrowAddress: pool.escrowAddress,
          asset: pool.assetSymbol,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to prepare maturity return: ${error.message}`);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to prepare maturity return: ${error.message}`);
    }
  }

  // ========== SPV PREFERENCES & ALERTS ==========

  /**
   * Set investment threshold for SPV
   * SPV can configure minimum amount to be alerted about
   */
  async setInvestmentThreshold(dto: SetInvestmentThresholdDto, spvAddress: string) {
    let poolId: string | null = null;

    if (dto.poolAddress) {
      const pool = await this.prisma.pool.findFirst({
        where: {
          poolAddress: dto.poolAddress.toLowerCase(),
          poolType: 'STABLE_YIELD',
        },
      });

      if (!pool) {
        throw new NotFoundException('Pool not found');
      }

      // Verify SPV can access this pool (assigned SPV or default admin)
      const canAccess = await this.canAccessPool(spvAddress, pool, 84532);
      if (!canAccess) {
        throw new BadRequestException('You are not assigned to this pool');
      }

      poolId = pool.id;
    }

    // Upsert preference
    const preference = await this.prisma.sPVPreference.upsert({
      where: poolId
        ? { poolId }
        : {
            // For global preferences, find by spvAddress with null poolId
            id:
              (
                await this.prisma.sPVPreference.findFirst({
                  where: { spvAddress, poolId: null },
                })
              )?.id || 'new',
          },
      create: {
        spvAddress,
        poolId,
        investmentThresholdEnabled: dto.enabled,
        minimumAmountToInvest: dto.minimumAmount,
        notificationsEnabled: dto.notificationsEnabled ?? true,
        emailNotifications: dto.emailNotifications ?? true,
        pushNotifications: dto.pushNotifications ?? false,
      },
      update: {
        investmentThresholdEnabled: dto.enabled,
        minimumAmountToInvest: dto.minimumAmount,
        notificationsEnabled: dto.notificationsEnabled,
        emailNotifications: dto.emailNotifications,
        pushNotifications: dto.pushNotifications,
      },
    });

    this.logger.log(
      `SPV ${spvAddress} set investment threshold: ${dto.minimumAmount} for ${
        poolId ? 'pool ' + poolId : 'all pools'
      }`,
    );

    return {
      success: true,
      preference: {
        id: preference.id,
        poolAddress: dto.poolAddress || null,
        enabled: preference.investmentThresholdEnabled,
        minimumAmount: preference.minimumAmountToInvest.toString(),
        notificationsEnabled: preference.notificationsEnabled,
        emailNotifications: preference.emailNotifications,
        pushNotifications: preference.pushNotifications,
      },
    };
  }

  /**
   * Get investment alerts for SPV
   * Shows pools that have funds available above SPV's threshold
   */
  async getInvestmentAlerts(query: GetAlertsQueryDto, spvAddress: string, chainId = 84532) {
    // Get SPV's pools
    const pools = await this.prisma.pool.findMany({
      where: {
        chainId,
        poolType: 'STABLE_YIELD',
        spvAddress: spvAddress.toLowerCase(),
        isActive: true,
        status: { in: ['FUNDING', 'INVESTED'] },
        ...(query.poolAddress && { poolAddress: query.poolAddress.toLowerCase() }),
      },
      include: {
        spvPreferences: true,
        analytics: true,
      },
    });

    const alerts = [];
    let totalAvailableToInvest = 0;

    for (const pool of pools) {
      try {
        // Get reserve status from contract
        const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
        const reserveStatus = await stableYieldManager.getReserveStatus(pool.poolAddress);

        const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
        const decimals = await assetContract.decimals();

        const currentReserve = Number(ethers.formatUnits(reserveStatus.currentReserve, decimals));
        const targetReserve = Number(ethers.formatUnits(reserveStatus.targetReserve, decimals));
        const availableToInvest = Math.max(0, currentReserve - targetReserve);

        // Check if above threshold
        const preference = pool.spvPreferences[0]; // Pool-specific preference
        const globalPreference = await this.prisma.sPVPreference.findFirst({
          where: { spvAddress, poolId: null },
        });

        const activePreference = preference || globalPreference;
        const threshold = activePreference?.investmentThresholdEnabled
          ? Number(activePreference.minimumAmountToInvest)
          : 0;

        if (availableToInvest > threshold && availableToInvest > 0) {
          const exceedsBy = availableToInvest - threshold;

          alerts.push({
            priority: exceedsBy > threshold * 2 ? 'high' : exceedsBy > threshold ? 'medium' : 'low',
            poolAddress: pool.poolAddress,
            poolName: pool.name,
            availableToInvest: availableToInvest.toFixed(2),
            yourThreshold: threshold.toFixed(2),
            exceedsBy: exceedsBy.toFixed(2),
            currentReserve: currentReserve.toFixed(2),
            targetReserve: targetReserve.toFixed(2),
            reserveRatio: `${(Number(reserveStatus.reserveRatio) / 100).toFixed(2)}%`,
            recommendation:
              'Request operator to allocate funds via POST /admin/pools/:address/allocate-to-spv',
          });

          totalAvailableToInvest += availableToInvest;
        }
      } catch (error) {
        this.logger.error(
          `Failed to check reserves for pool ${pool.poolAddress}: ${error.message}`,
        );
      }
    }

    // Sort by priority
    const priorityOrder: { [key: string]: number } = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        totalAvailableToInvest: totalAvailableToInvest.toFixed(2),
        poolsMonitored: pools.length,
      },
    };
  }

  /**
   * Get all SPV preferences
   */
  async getPreferences(spvAddress: string) {
    const preferences = await this.prisma.sPVPreference.findMany({
      where: { spvAddress },
      include: {
        pool: {
          select: {
            poolAddress: true,
            name: true,
          },
        },
      },
    });

    return {
      preferences: preferences.map((pref) => ({
        id: pref.id,
        poolAddress: pref.pool?.poolAddress || null,
        poolName: pref.pool?.name || 'All Pools',
        enabled: pref.investmentThresholdEnabled,
        minimumAmount: pref.minimumAmountToInvest.toString(),
        notificationsEnabled: pref.notificationsEnabled,
        emailNotifications: pref.emailNotifications,
        pushNotifications: pref.pushNotifications,
        createdAt: pref.createdAt,
        updatedAt: pref.updatedAt,
      })),
    };
  }

  // ========== ENHANCED POOL DETAIL (SPV DASHBOARD) ==========

  /**
   * Get comprehensive pool detail for SPV
   * This is the main dashboard for SPV to manage a pool
   */
  async getSPVPoolDetail(poolAddress: string, spvAddress: string, chainId = 84532) {
    const pool = await this.prisma.pool.findFirst({
      where: {
        poolAddress: poolAddress.toLowerCase(),
        chainId,
        poolType: 'STABLE_YIELD',
      },
      include: {
        analytics: true,
        instruments: {
          where: { isActive: true },
          orderBy: { maturityDate: 'asc' },
          take: 5,
        },
        withdrawalRequests: {
          where: { status: 'QUEUED' },
        },
        spvOperations: {
          where: {
            status: { in: ['PENDING', 'APPROVED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        spvPreferences: true,
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found at address ${poolAddress}`);
    }

    this.logger.debug(
      `Found pool: ${pool.name} (${pool.poolAddress}), Status: ${pool.status}, SPV: ${pool.spvAddress}, OnChain: ${pool.createdOnChain}`,
    );

    // Verify SPV can access this pool (assigned SPV or default admin)
    const canAccess = await this.canAccessPool(spvAddress, pool, chainId);
    if (!canAccess) {
      throw new BadRequestException(
        `Access denied. You (${spvAddress}) are not assigned to this pool. Pool SPV: ${
          pool.spvAddress || 'none'
        }`,
      );
    }

    //Check if pool is actually registered in the StableYieldManager contract
    if (
      !pool.createdOnChain ||
      !pool.poolAddress ||
      pool.poolAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new BadRequestException(
        `Pool "${pool.name}" has been created in database but not yet registered on the blockchain. ` +
          `The admin must call registerPool() on the StableYieldManager contract and then confirm via POST /admin/pools/confirm-deployment`,
      );
    }

    // Get reserve status from contract
    const stableYieldManager = this.blockchain.getStableYieldManager(chainId);
    let reserveStatus: any;
    let currentReserve: number;
    let targetReserve: number;
    let reserveRatio: number;
    let minRequired: number;
    let maxAllowed: number;

    try {
      // This will revert if pool is not registered in contract (poolExists modifier)
      reserveStatus = await stableYieldManager.getReserveStatus(pool.poolAddress);

      // Check if contract returned valid data
      if (!reserveStatus) {
        throw new Error('No reserve status returned from contract');
      }

      const assetContract = this.blockchain.getERC20(chainId, pool.assetAddress);
      const decimals = await assetContract.decimals();

      // Contract returns: [currentReserve, targetReserve, reserveRatio, rebalanceNeeded]
      // Format the values that exist
      currentReserve = Number(
        ethers.formatUnits(reserveStatus.currentReserve || reserveStatus[0], decimals),
      );
      targetReserve = Number(
        ethers.formatUnits(reserveStatus.targetReserve || reserveStatus[1], decimals),
      );
      reserveRatio = Number(reserveStatus.reserveRatio || reserveStatus[2]) / 100;

      // Calculate min/max reserves based on the 8-12% range (contract uses 10% target with 2% tolerance)
      const totalNAV =
        currentReserve + targetReserve > 0 ? currentReserve / (reserveRatio / 100) : 0;
      minRequired = totalNAV * 0.08; // 8% minimum
      maxAllowed = totalNAV * 0.12; // 12% maximum
    } catch (error) {
      this.logger.error(
        `Failed to get reserve status for pool ${pool.poolAddress}: ${error.message}`,
      );
      throw new BadRequestException(
        `Unable to fetch reserve data from StableYieldManager contract for pool "${pool.name}". ` +
          `Contract error: ${error.message}`,
      );
    }

    const availableToInvest = Math.max(0, currentReserve - targetReserve);

    // Determine reserve status
    let reserveStatusLabel: string;
    let needsRebalance = reserveStatus.rebalanceNeeded;
    let rebalanceAction: 'invest' | 'liquidate' | null = null;

    if (currentReserve < minRequired) {
      reserveStatusLabel = 'critical';
      rebalanceAction = 'liquidate';
    } else if (currentReserve < targetReserve * 0.9) {
      reserveStatusLabel = 'low';
      rebalanceAction = 'liquidate';
    } else if (currentReserve > maxAllowed) {
      reserveStatusLabel = 'excess';
      rebalanceAction = 'invest';
    } else if (currentReserve > targetReserve * 1.1) {
      reserveStatusLabel = 'excess';
      rebalanceAction = 'invest';
    } else {
      reserveStatusLabel = 'optimal';
    }

    // Check SPV threshold
    const preference = pool.spvPreferences[0];
    const threshold = preference?.investmentThresholdEnabled
      ? Number(preference.minimumAmountToInvest)
      : 0;
    const isAboveThreshold = availableToInvest >= threshold;

    // Get all active instruments summary
    const allInstruments = await this.prisma.instrument.findMany({
      where: {
        poolId: pool.id,
        isActive: true,
      },
    });

    const totalInvested = allInstruments.reduce((sum, inst) => sum + Number(inst.purchasePrice), 0);
    const totalFaceValue = allInstruments.reduce((sum, inst) => sum + Number(inst.faceValue), 0);
    const unrealizedGains = totalFaceValue - totalInvested;

    const instrumentsByType = {
      DISCOUNTED: {
        count: allInstruments.filter((i) => i.instrumentType === 'DISCOUNTED').length,
        value: allInstruments
          .filter((i) => i.instrumentType === 'DISCOUNTED')
          .reduce((sum, inst) => sum + Number(inst.purchasePrice), 0)
          .toFixed(2),
      },
      INTEREST_BEARING: {
        count: allInstruments.filter((i) => i.instrumentType === 'INTEREST_BEARING').length,
        value: allInstruments
          .filter((i) => i.instrumentType === 'INTEREST_BEARING')
          .reduce((sum, inst) => sum + Number(inst.purchasePrice), 0)
          .toFixed(2),
      },
    };

    // Calculate pending withdrawals impact
    const pendingWithdrawals = pool.withdrawalRequests.reduce(
      (sum: number, req: any) => sum + Number(req.shares),
      0,
    );
    const estimatedWithdrawalValue = pool.withdrawalRequests.reduce(
      (sum: number, req: any) => sum + Number(req.estimatedValue),
      0,
    );

    // Determine pending actions for SPV
    const pendingActions = [];

    // Action 1: Pull funds if available above threshold
    if (isAboveThreshold && availableToInvest > 0) {
      pendingActions.push({
        priority: availableToInvest > threshold * 2 ? 'high' : 'medium',
        action: 'PULL_FUNDS',
        title: 'Funds Available to Invest',
        description: `${availableToInvest.toFixed(2)} ${
          pool.assetSymbol
        } available (above your ${threshold.toFixed(2)} threshold)`,
        amount: availableToInvest.toFixed(2),
        endpoint: '/api/v1/admin/pools/:address/allocate-to-spv',
        note: 'Request operator to allocate funds to your SPV wallet',
      });
    }

    // Action 2: Instruments maturing soon
    const maturingSoon = allInstruments.filter((inst) => {
      const daysToMaturity = Math.floor(
        (inst.maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return daysToMaturity <= 7 && daysToMaturity >= 0;
    });

    if (maturingSoon.length > 0) {
      const totalMaturityValue = maturingSoon.reduce(
        (sum, inst) => sum + Number(inst.faceValue),
        0,
      );
      pendingActions.push({
        priority: 'medium',
        action: 'RECORD_MATURITY',
        title: `${maturingSoon.length} Instrument(s) Maturing Soon`,
        description: `${
          maturingSoon.length
        } instruments mature in next 7 days (${totalMaturityValue.toFixed(2)} ${
          pool.assetSymbol
        } value)`,
        amount: totalMaturityValue.toFixed(2),
        instrumentIds: maturingSoon.map((i) => i.id),
        endpoint: '/api/v1/spv/pools/:address/receive-maturity',
      });
    }

    // Action 3: NAV update needed
    const lastNAVUpdate = await this.prisma.nAVHistory.findFirst({
      where: { poolId: pool.id },
      orderBy: { timestamp: 'desc' },
    });

    const daysSinceNAVUpdate = lastNAVUpdate
      ? Math.floor((Date.now() - lastNAVUpdate.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceNAVUpdate > 3) {
      pendingActions.push({
        priority: daysSinceNAVUpdate > 7 ? 'high' : 'low',
        action: 'UPDATE_NAV',
        title: 'NAV Update Recommended',
        description: `Last NAV update was ${daysSinceNAVUpdate} days ago`,
        endpoint: '/api/v1/spv/pools/:address/trigger-nav-update',
      });
    }

    // Recent activity
    const recentActivity = await this.prisma.sPVOperation.findMany({
      where: { poolId: pool.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      pool: {
        address: pool.poolAddress,
        name: pool.name,
        status: pool.status,
        type: pool.poolType,
        assetSymbol: pool.assetSymbol,
        totalValueLocked: pool.analytics?.totalValueLocked || '0',
        totalShares: pool.analytics?.totalShares || '0',
        navPerShare: pool.analytics?.navPerShare || '1.0',
        projectedAPY: pool.projectedAPY?.toString() || '0',
        activeInvestors: pool.analytics?.uniqueInvestors || 0,
        createdAt: pool.createdAt,
        assignedSPV: pool.spvAddress,
        isAssignedToMe: pool.spvAddress?.toLowerCase() === spvAddress.toLowerCase(),
      },
      reserves: {
        current: currentReserve.toFixed(2),
        target: targetReserve.toFixed(2),
        targetRatio: '10.00',
        currentRatio: reserveRatio.toFixed(2),
        minRequired: minRequired.toFixed(2),
        maxAllowed: maxAllowed.toFixed(2),
        availableToInvest: availableToInvest.toFixed(2),
        status: reserveStatusLabel,
        needsRebalance,
        rebalanceAction,
        spvThreshold: {
          enabled: preference?.investmentThresholdEnabled || false,
          minimumToPull: threshold.toFixed(2),
          isAboveThreshold,
          notificationEnabled: preference?.notificationsEnabled || false,
        },
      },
      investments: {
        totalInvested: totalInvested.toFixed(2),
        activeInstruments: allInstruments.length,
        totalInstrumentValue: totalInvested.toFixed(2),
        unrealizedGains: unrealizedGains.toFixed(2),
        byType: instrumentsByType,
      },
      instruments: pool.instruments.map((inst: any) => ({
        id: inst.id,
        type: inst.instrumentType,
        purchasePrice: inst.purchasePrice.toString(),
        faceValue: inst.faceValue.toString(),
        currentValue: inst.faceValue.toString(), // TODO: Mark-to-market
        maturityDate: inst.maturityDate,
        daysToMaturity: Math.floor(
          (inst.maturityDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
        expectedReturn: (Number(inst.faceValue) - Number(inst.purchasePrice)).toFixed(2),
        status: inst.isActive ? 'ACTIVE' : 'MATURED',
      })),
      withdrawalQueue: {
        pendingCount: pool.withdrawalRequests.length,
        totalSharesRequested: pendingWithdrawals.toFixed(2),
        totalAssetValue: estimatedWithdrawalValue.toFixed(2),
        canBeFulfilledNow: pool.withdrawalRequests.filter(
          (req: any) => Number(req.estimatedValue) <= currentReserve,
        ).length,
        blockedByReserves: pool.withdrawalRequests.filter(
          (req: any) => Number(req.estimatedValue) > currentReserve,
        ).length,
      },
      pendingActions,
      recentActivity: recentActivity.map((op) => ({
        type: op.operationType,
        timestamp: op.createdAt,
        description: op.notes || op.operationType,
        amount: op.amount?.toString() || '0',
        status: op.status,
      })),
    };
  }
}
