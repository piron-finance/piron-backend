import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma.service';
import { WebhookEventDto } from './dtos/webhook-event.dto';
import { UserType, TxStatus, PoolStatus } from '@prisma/client';

// Base Sepolia chainId
const CHAIN_ID = 84532;

@Processor('immediate-events')
export class ImmediateEventProcessor {
  private readonly logger = new Logger(ImmediateEventProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('process-immediate')
  async handleImmediateEvent(job: Job<WebhookEventDto>) {
    const event = job.data;
    this.logger.log(`Processing immediate event: ${event.event}`);

    try {
      await this.processEventByType(event);
      this.logger.log(`✅ Successfully processed: ${event.event}`);
    } catch (error) {
      this.logger.error(`❌ Failed to process ${event.event}: ${error.message}`);
      throw error; // Rethrow for Bull to retry
    }
  }

  private async processEventByType(event: WebhookEventDto) {
    const { event: eventName, data } = event;

    switch (eventName) {
      case 'Deposit':
        await this.handleDeposit(data);
        break;
      case 'Withdraw':
        await this.handleWithdraw(data);
        break;
      case 'PoolCreated':
      case 'StableYieldPoolCreated':
        await this.handlePoolCreated(data);
        break;
      case 'CouponClaimed':
        await this.handleCouponClaimed(data);
        break;
      case 'WithdrawalProcessed':
        await this.handleWithdrawalProcessed(data);
        break;
      case 'EmergencyWithdrawal':
        await this.handleEmergencyWithdrawal(data);
        break;
      case 'PoolCancelled':
        await this.handlePoolCancelled(data);
        break;
      case 'EmergencyStateChanged':
        await this.handleEmergencyState(data);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${eventName}`);
    }
  }

  private async handleDeposit(data: any) {
    const { transaction, user, pool, amount, shares } = data;

    // Upsert user
    await this.prisma.user.upsert({
      where: { walletAddress: user.walletAddress.toLowerCase() },
      update: {},
      create: {
        walletAddress: user.walletAddress.toLowerCase(),
        userType: UserType.REGULAR_USER,
      },
    });

    // Get user and pool IDs
    const userRecord = await this.prisma.user.findUnique({
      where: { walletAddress: user.walletAddress.toLowerCase() },
    });

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!userRecord || !poolRecord) {
      throw new Error('User or Pool not found');
    }

    // Upsert position
    await this.prisma.poolPosition.upsert({
      where: {
        userId_poolId: {
          userId: userRecord.id,
          poolId: poolRecord.id,
        },
      },
      update: {
        totalDeposited: { increment: parseFloat(amount) },
        totalShares: { increment: parseFloat(shares) },
        currentValue: { increment: parseFloat(amount) },
        lastDepositTime: new Date(transaction.timestamp * 1000),
        isActive: true,
      },
      create: {
        userId: userRecord.id,
        poolId: poolRecord.id,
        totalDeposited: parseFloat(amount),
        totalWithdrawn: 0,
        totalShares: parseFloat(shares),
        currentValue: parseFloat(amount),
        unrealizedReturn: 0,
        realizedReturn: 0,
        isActive: true,
        lastDepositTime: new Date(transaction.timestamp * 1000),
      },
    });

    // Create transaction record
    await this.prisma.transaction.upsert({
      where: { txHash: transaction.txHash },
      update: {},
      create: {
        txHash: transaction.txHash,
        userId: userRecord.id,
        poolId: poolRecord.id,
        chainId: poolRecord.chainId,
        type: 'DEPOSIT',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(amount),
        shares: parseFloat(shares),
        timestamp: new Date(transaction.timestamp * 1000),
        blockNumber: BigInt(transaction.blockNumber),
      },
    });

    // Update pool analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: poolRecord.id },
      data: {
        totalValueLocked: { increment: parseFloat(amount) },
        totalShares: { increment: parseFloat(shares) },
        totalDeposits: { increment: parseFloat(amount) },
        netFlow: { increment: parseFloat(amount) },
        volume24h: { increment: parseFloat(amount) },
        depositors24h: { increment: 1 },
      },
    });
  }

  private async handleWithdraw(data: any) {
    const { transaction, user, pool, amount, shares } = data;

    const userRecord = await this.prisma.user.findUnique({
      where: { walletAddress: user.walletAddress.toLowerCase() },
    });

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!userRecord || !poolRecord) {
      throw new Error('User or Pool not found');
    }

    // Update position
    await this.prisma.poolPosition.update({
      where: {
        userId_poolId: {
          userId: userRecord.id,
          poolId: poolRecord.id,
        },
      },
      data: {
        totalWithdrawn: { increment: parseFloat(amount) },
        totalShares: { decrement: parseFloat(shares) },
        currentValue: { decrement: parseFloat(amount) },
      },
    });

    // Create transaction record
    await this.prisma.transaction.upsert({
      where: { txHash: transaction.txHash },
      update: {},
      create: {
        txHash: transaction.txHash,
        userId: userRecord.id,
        poolId: poolRecord.id,
        chainId: poolRecord.chainId,
        type: 'WITHDRAWAL',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(amount),
        shares: parseFloat(shares),
        timestamp: new Date(transaction.timestamp * 1000),
        blockNumber: BigInt(transaction.blockNumber),
      },
    });

    // Update pool analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: poolRecord.id },
      data: {
        totalValueLocked: { decrement: parseFloat(amount) },
        totalShares: { decrement: parseFloat(shares) },
        totalWithdrawals: { increment: parseFloat(amount) },
        netFlow: { decrement: parseFloat(amount) },
        volume24h: { increment: parseFloat(amount) },
      },
    });
  }

  private async handlePoolCreated(data: any) {
    // Pool already created via admin API, just update status
    const { pool } = data;

    await this.prisma.pool.update({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
      data: {
        status: PoolStatus.FUNDING,
      },
    });
  }

  private async handleCouponClaimed(data: any) {
    // Record coupon claim transaction
    const { transaction, user, pool, amount } = data;

    const userRecord = await this.prisma.user.findUnique({
      where: { walletAddress: user.walletAddress.toLowerCase() },
    });

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!userRecord || !poolRecord) return;

    await this.prisma.transaction.upsert({
      where: { txHash: transaction.txHash },
      update: {},
      create: {
        txHash: transaction.txHash,
        userId: userRecord.id,
        poolId: poolRecord.id,
        chainId: poolRecord.chainId,
        type: 'COUPON_CLAIM',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(amount),
        timestamp: new Date(transaction.timestamp * 1000),
        blockNumber: BigInt(transaction.blockNumber),
      },
    });
  }

  private async handleWithdrawalProcessed(data: any) {
    // Already handled in Withdraw event
  }

  private async handleEmergencyWithdrawal(data: any) {
    const { transaction, user, pool, refundAmount, sharesBurned } = data;

    const userRecord = await this.prisma.user.findUnique({
      where: { walletAddress: user.walletAddress.toLowerCase() },
    });

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!userRecord || !poolRecord) return;

    await this.prisma.transaction.upsert({
      where: { txHash: transaction.txHash },
      update: {},
      create: {
        txHash: transaction.txHash,
        userId: userRecord.id,
        poolId: poolRecord.id,
        chainId: poolRecord.chainId,
        type: 'EMERGENCY_WITHDRAWAL',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(refundAmount),
        shares: parseFloat(sharesBurned),
        timestamp: new Date(transaction.timestamp * 1000),
        blockNumber: BigInt(transaction.blockNumber),
      },
    });
  }

  private async handlePoolCancelled(data: any) {
    const { pool } = data;

    await this.prisma.pool.update({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
      data: {
        status: PoolStatus.CANCELLED,
        isActive: false,
      },
    });
  }

  private async handleEmergencyState(data: any) {
    const { pool } = data;

    await this.prisma.pool.update({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
      data: {
        status: PoolStatus.EMERGENCY,
      },
    });
  }
}

@Processor('delayed-events')
export class DelayedEventProcessor {
  private readonly logger = new Logger(DelayedEventProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('process-delayed')
  async handleDelayedEvent(job: Job<WebhookEventDto>) {
    const event = job.data;
    this.logger.log(`Processing delayed event: ${event.event}`);

    try {
      await this.processEventByType(event);
      this.logger.log(`✅ Successfully processed delayed: ${event.event}`);
    } catch (error) {
      this.logger.error(`❌ Failed to process delayed ${event.event}: ${error.message}`);
      throw error;
    }
  }

  private async processEventByType(event: WebhookEventDto) {
    const { event: eventName, data } = event;

    switch (eventName) {
      case 'NAVUpdated':
        await this.handleNAVUpdated(data);
        break;
      case 'InstrumentPurchased':
        await this.handleInstrumentPurchased(data);
        break;
      case 'InstrumentMatured':
        await this.handleInstrumentMatured(data);
        break;
      default:
        this.logger.log(`Delayed event logged: ${eventName}`);
    }
  }

  private async handleNAVUpdated(data: any) {
    const { pool, navPerShare, totalNAV, totalShares, cashReserves, instrumentValue, timestamp } = data;

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!poolRecord) return;

    // Update pool analytics with new NAV
    await this.prisma.poolAnalytics.update({
      where: { poolId: poolRecord.id },
      data: {
        navPerShare: parseFloat(navPerShare),
        totalValueLocked: parseFloat(totalNAV),
        totalShares: parseFloat(totalShares || '0'),
      },
    });

    // Create NAV history record
    await this.prisma.nAVHistory.create({
      data: {
        poolId: poolRecord.id,
        navPerShare: parseFloat(navPerShare),
        totalNAV: parseFloat(totalNAV),
        totalShares: parseFloat(totalShares || '0'),
        cashReserves: parseFloat(cashReserves || '0'),
        instrumentValue: parseFloat(instrumentValue || '0'),
        accruedFees: 0,
        timestamp: new Date(timestamp * 1000),
      },
    });
  }

  private async handleInstrumentPurchased(data: any) {
    const { pool, instrument } = data;

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!poolRecord) return;

    await this.prisma.instrument.create({
      data: {
        poolId: poolRecord.id,
        instrumentId: parseInt(instrument.instrumentId || instrument.id),
        instrumentType: instrument.instrumentType,
        purchasePrice: parseFloat(instrument.purchasePrice),
        faceValue: parseFloat(instrument.faceValue),
        purchaseDate: new Date(instrument.purchaseDate * 1000),
        maturityDate: new Date(instrument.maturityDate * 1000),
        isActive: true,
      },
    });
  }

  private async handleInstrumentMatured(data: any) {
    const { pool, instrumentId, realizedYield } = data;

    const poolRecord = await this.prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId: CHAIN_ID,
          poolAddress: pool.poolAddress.toLowerCase(),
        },
      },
    });

    if (!poolRecord) return;

    // Mark instrument as matured
    await this.prisma.instrument.updateMany({
      where: {
        poolId: poolRecord.id,
        instrumentId: parseInt(instrumentId),
        isActive: true,
      },
      data: {
        isActive: false,
        maturedAt: new Date(),
        realizedYield: parseFloat(realizedYield),
      },
    });
  }
}

// Export a combined service for the module
@Injectable()
export class EventProcessorService {
  constructor(
    private readonly immediateProcessor: ImmediateEventProcessor,
    private readonly delayedProcessor: DelayedEventProcessor,
  ) {}
}

