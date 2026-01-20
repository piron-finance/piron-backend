import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma.service';
import { UserType, TxStatus, InterestPayment, LockedPositionStatus } from '@prisma/client';
import LockedManagerABI from '../contracts/abis/LockedManager.json';

@Injectable()
export class LockedPositionIndexer implements OnModuleInit {
  private readonly logger = new Logger(LockedPositionIndexer.name);
  private isRunning = false;
  private readonly pollingInterval = 12000; // 12 seconds

  constructor(
    private blockchain: BlockchainService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.start();
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('Locked position indexer already running');
      return;
    }
    this.isRunning = true;
    this.logger.log('🔐 Locked position indexer started');
    this.pollForEvents(84532);
  }

  stop() {
    this.isRunning = false;
    this.logger.log('Locked position indexer stopped');
  }

  private async pollForEvents(chainId: number) {
    while (this.isRunning) {
      try {
        await this.indexLockedPositionEvents(chainId);
      } catch (error) {
        this.logger.error(`Error in locked position indexer: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
    }
  }

  private async indexLockedPositionEvents(chainId: number) {
    // Get all active locked pools
    const lockedPools = await this.prisma.pool.findMany({
      where: {
        chainId,
        poolType: 'LOCKED',
        isActive: true,
        poolAddress: { not: '' },
      },
    });

    if (lockedPools.length === 0) {
      return;
    }

    const provider = this.blockchain.getProvider(chainId);
    const currentBlock = await provider.getBlockNumber();
    const lastCheckedBlock = (await this.getLastCheckedBlock(chainId)) || currentBlock - 100;

    if (currentBlock <= lastCheckedBlock) {
      return;
    }

    const fromBlock = lastCheckedBlock + 1;
    const maxBlockRange = parseInt(process.env.INDEXER_MAX_BLOCK_RANGE || '250', 10);
    const toBlock = Math.min(currentBlock, fromBlock + maxBlockRange - 1);

    this.logger.debug(
      `Checking locked position events from block ${fromBlock} to ${toBlock} (range: ${toBlock - fromBlock + 1})`,
    );

    // Index events from LockedPoolManager
    await this.indexManagerEvents(chainId, fromBlock, toBlock, lockedPools);

    await this.updateLastCheckedBlock(chainId, toBlock);
  }

  private async indexManagerEvents(
    chainId: number,
    fromBlock: number,
    toBlock: number,
    pools: any[],
  ) {
    try {
      const manager = this.blockchain.getLockedPoolManager(chainId);

      // Index PositionCreated events
      const positionCreatedFilter = manager.filters.PositionCreated();
      const positionCreatedEvents = await manager.queryFilter(positionCreatedFilter, fromBlock, toBlock);

      for (const event of positionCreatedEvents) {
        await this.handlePositionCreated(chainId, event as ethers.EventLog, pools);
      }

      // Index PositionRedeemed events
      const positionRedeemedFilter = manager.filters.PositionRedeemed();
      const positionRedeemedEvents = await manager.queryFilter(positionRedeemedFilter, fromBlock, toBlock);

      for (const event of positionRedeemedEvents) {
        await this.handlePositionRedeemed(chainId, event as ethers.EventLog);
      }

      // Index EarlyExitProcessed events
      const earlyExitFilter = manager.filters.EarlyExitProcessed();
      const earlyExitEvents = await manager.queryFilter(earlyExitFilter, fromBlock, toBlock);

      for (const event of earlyExitEvents) {
        await this.handleEarlyExit(chainId, event as ethers.EventLog);
      }

      // Index PositionRolledOver events
      const rolloverFilter = manager.filters.PositionRolledOver();
      const rolloverEvents = await manager.queryFilter(rolloverFilter, fromBlock, toBlock);

      for (const event of rolloverEvents) {
        await this.handleRollover(chainId, event as ethers.EventLog, pools);
      }

      // Index AutoRolloverSet events
      const autoRolloverFilter = manager.filters.AutoRolloverSet();
      const autoRolloverEvents = await manager.queryFilter(autoRolloverFilter, fromBlock, toBlock);

      for (const event of autoRolloverEvents) {
        await this.handleAutoRolloverSet(event as ethers.EventLog);
      }

      // Index InterestPaidUpfront events
      const interestPaidFilter = manager.filters.InterestPaidUpfront();
      const interestPaidEvents = await manager.queryFilter(interestPaidFilter, fromBlock, toBlock);

      for (const event of interestPaidEvents) {
        await this.handleInterestPaidUpfront(chainId, event as ethers.EventLog);
      }
    } catch (error) {
      this.logger.error(`Error indexing manager events: ${error.message}`);
    }
  }

  /**
   * Handle PositionCreated event
   * Event: PositionCreated(pool, user, positionId, principal, interest, paymentChoice, lockEnd)
   */
  private async handlePositionCreated(chainId: number, event: ethers.EventLog, pools: any[]) {
    const { pool: poolAddress, user, positionId, principal, interest, choice, lockEnd } = event.args;

    // Find pool in our database
    const pool = pools.find(p => p.poolAddress.toLowerCase() === poolAddress.toLowerCase());
    if (!pool) {
      this.logger.warn(`Pool ${poolAddress} not found in database`);
      return;
    }

    // Check if position already indexed
    const existingPosition = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(positionId) },
    });

    if (existingPosition) {
      this.logger.debug(`Position ${positionId} already indexed`);
      return;
    }

    this.logger.log(
      `🔐 Position created: ${positionId} in pool ${pool.name} by ${user.substring(0, 8)}...`,
    );

    // Get block timestamp
    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    if (!block) {
      this.logger.error(`Block ${event.blockNumber} not found`);
      return;
    }
    const timestamp = new Date(block.timestamp * 1000);

    // Upsert user
    const dbUser = await this.prisma.user.upsert({
      where: { walletAddress: user.toLowerCase() },
      update: {},
      create: {
        walletAddress: user.toLowerCase(),
        userType: UserType.REGULAR_USER,
      },
    });

    // Get position details from contract to get tier info
    const positionData = await this.blockchain.getPosition(chainId, Number(positionId));

    // Find or create the lock tier
    const tier = await this.prisma.lockTier.findFirst({
      where: {
        poolId: pool.id,
        tierIndex: Number(positionData.tierIndex),
      },
    });

    if (!tier) {
      this.logger.error(`Tier ${positionData.tierIndex} not found for pool ${pool.id}`);
      return;
    }

    // Calculate values
    const principalDecimal = parseFloat(ethers.formatUnits(principal, pool.assetDecimals));
    const interestDecimal = parseFloat(ethers.formatUnits(interest, pool.assetDecimals));
    const interestPayment = Number(choice) === 0 ? InterestPayment.UPFRONT : InterestPayment.AT_MATURITY;

    // For UPFRONT: investedAmount = principal - interest
    // For AT_MATURITY: investedAmount = principal
    const investedAmount = interestPayment === InterestPayment.UPFRONT
      ? principalDecimal - interestDecimal
      : principalDecimal;

    // Expected payout
    // For UPFRONT: expectedMaturityPayout = principal
    // For AT_MATURITY: expectedMaturityPayout = principal + interest
    const expectedMaturityPayout = interestPayment === InterestPayment.UPFRONT
      ? principalDecimal
      : principalDecimal + interestDecimal;

    // Create locked position
    await this.prisma.lockedPosition.create({
      data: {
        positionId: Number(positionId),
        userId: dbUser.id,
        poolId: pool.id,
        tierId: tier.id,
        principal: principalDecimal,
        investedAmount: investedAmount,
        interest: interestDecimal,
        interestPayment: interestPayment,
        expectedMaturityPayout: expectedMaturityPayout,
        depositTime: timestamp,
        lockEndTime: new Date(Number(lockEnd) * 1000),
        status: LockedPositionStatus.ACTIVE,
        autoRollover: false,
        depositTxHash: event.transactionHash,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: dbUser.id,
        poolId: pool.id,
        chainId,
        type: 'POSITION_CREATED',
        status: TxStatus.CONFIRMED,
        amount: principalDecimal,
        shares: investedAmount,
        timestamp,
        blockNumber: BigInt(event.blockNumber),
        lockedPositionId: Number(positionId),
      },
    });

    // Update pool analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: pool.id },
      data: {
        totalValueLocked: { increment: investedAmount },
        totalShares: { increment: investedAmount },
        totalDeposits: { increment: principalDecimal },
        totalPrincipalLocked: { increment: principalDecimal },
        activePositions: { increment: 1 },
        uniqueInvestors: { increment: 1 }, // May over-count, but safe
        depositors24h: { increment: 1 },
        volume24h: { increment: principalDecimal },
      },
    });

    this.logger.log(`✅ Position ${positionId} indexed: ${principalDecimal} ${pool.assetSymbol}`);
  }

  /**
   * Handle PositionRedeemed event
   * Event: PositionRedeemed(pool, user, positionId, payout)
   */
  private async handlePositionRedeemed(chainId: number, event: ethers.EventLog) {
    const { pool: poolAddress, user, positionId, payout } = event.args;

    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(positionId) },
      include: { pool: true },
    });

    if (!position) {
      this.logger.warn(`Position ${positionId} not found for redemption`);
      return;
    }

    this.logger.log(`💰 Position ${positionId} redeemed by ${user.substring(0, 8)}...`);

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

    const payoutDecimal = parseFloat(ethers.formatUnits(payout, position.pool.assetDecimals));

    // Update position
    await this.prisma.lockedPosition.update({
      where: { positionId: Number(positionId) },
      data: {
        status: LockedPositionStatus.REDEEMED,
        actualPayout: payoutDecimal,
        exitTime: timestamp,
        exitTxHash: event.transactionHash,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: position.userId,
        poolId: position.poolId,
        chainId,
        type: 'POSITION_REDEEMED',
        status: TxStatus.CONFIRMED,
        amount: payoutDecimal,
        timestamp,
        blockNumber: BigInt(event.blockNumber),
        lockedPositionId: Number(positionId),
      },
    });

    // Update analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: position.poolId },
      data: {
        totalValueLocked: { decrement: Number(position.investedAmount) },
        totalShares: { decrement: Number(position.investedAmount) },
        totalWithdrawals: { increment: payoutDecimal },
        activePositions: { decrement: 1 },
      },
    });

    this.logger.log(`✅ Position ${positionId} redemption indexed`);
  }

  /**
   * Handle EarlyExitProcessed event
   * Event: EarlyExitProcessed(pool, user, positionId, payout, penalty, interestEarned)
   */
  private async handleEarlyExit(chainId: number, event: ethers.EventLog) {
    const { pool: poolAddress, user, positionId, payout, penalty, interestEarned } = event.args;

    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(positionId) },
      include: { pool: true },
    });

    if (!position) {
      this.logger.warn(`Position ${positionId} not found for early exit`);
      return;
    }

    this.logger.log(`⚠️ Position ${positionId} early exit by ${user.substring(0, 8)}...`);

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

    const payoutDecimal = parseFloat(ethers.formatUnits(payout, position.pool.assetDecimals));
    const penaltyDecimal = parseFloat(ethers.formatUnits(penalty, position.pool.assetDecimals));
    const interestEarnedDecimal = parseFloat(ethers.formatUnits(interestEarned, position.pool.assetDecimals));

    // Update position
    await this.prisma.lockedPosition.update({
      where: { positionId: Number(positionId) },
      data: {
        status: LockedPositionStatus.EARLY_EXIT,
        actualPayout: payoutDecimal,
        penaltyPaid: penaltyDecimal,
        proRataInterest: interestEarnedDecimal,
        exitTime: timestamp,
        exitTxHash: event.transactionHash,
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: position.userId,
        poolId: position.poolId,
        chainId,
        type: 'EARLY_EXIT',
        status: TxStatus.CONFIRMED,
        amount: payoutDecimal,
        fee: penaltyDecimal,
        timestamp,
        blockNumber: BigInt(event.blockNumber),
        lockedPositionId: Number(positionId),
      },
    });

    // Update analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: position.poolId },
      data: {
        totalValueLocked: { decrement: Number(position.investedAmount) },
        totalShares: { decrement: Number(position.investedAmount) },
        totalWithdrawals: { increment: payoutDecimal },
        totalPenaltiesCollected: { increment: penaltyDecimal },
        activePositions: { decrement: 1 },
      },
    });

    this.logger.log(`✅ Position ${positionId} early exit indexed (penalty: ${penaltyDecimal})`);
  }

  /**
   * Handle PositionRolledOver event
   * Event: PositionRolledOver(pool, user, oldPositionId, newPositionId, principal, interestHandled)
   */
  private async handleRollover(chainId: number, event: ethers.EventLog, pools: any[]) {
    const { pool: poolAddress, user, oldPositionId, newPositionId, principal, interestHandled } = event.args;

    const oldPosition = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(oldPositionId) },
      include: { pool: true, tier: true },
    });

    if (!oldPosition) {
      this.logger.warn(`Old position ${oldPositionId} not found for rollover`);
      return;
    }

    this.logger.log(`🔄 Position ${oldPositionId} rolled over to ${newPositionId}`);

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

    // Update old position
    await this.prisma.lockedPosition.update({
      where: { positionId: Number(oldPositionId) },
      data: {
        status: LockedPositionStatus.ROLLED_OVER,
        rolledToPositionId: Number(newPositionId),
        exitTime: timestamp,
        exitTxHash: event.transactionHash,
      },
    });

    // The new position will be created by PositionCreated event
    // But we can link it if it already exists
    const newPosition = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(newPositionId) },
    });

    if (newPosition) {
      await this.prisma.lockedPosition.update({
        where: { positionId: Number(newPositionId) },
        data: {
          rolledFromPositionId: Number(oldPositionId),
        },
      });
    }

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: oldPosition.userId,
        poolId: oldPosition.poolId,
        chainId,
        type: 'ROLLOVER',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(ethers.formatUnits(principal, oldPosition.pool.assetDecimals)),
        timestamp,
        blockNumber: BigInt(event.blockNumber),
        lockedPositionId: Number(oldPositionId),
      },
    });

    this.logger.log(`✅ Rollover ${oldPositionId} → ${newPositionId} indexed`);
  }

  /**
   * Handle AutoRolloverSet event
   * Event: AutoRolloverSet(positionId, user, enabled)
   */
  private async handleAutoRolloverSet(event: ethers.EventLog) {
    const { positionId, user, enabled } = event.args;

    await this.prisma.lockedPosition.update({
      where: { positionId: Number(positionId) },
      data: {
        autoRollover: enabled,
      },
    });

    this.logger.log(`🔄 Auto-rollover ${enabled ? 'enabled' : 'disabled'} for position ${positionId}`);
  }

  /**
   * Handle InterestPaidUpfront event
   * Event: InterestPaidUpfront(pool, user, positionId, amount)
   */
  private async handleInterestPaidUpfront(chainId: number, event: ethers.EventLog) {
    const { pool: poolAddress, user, positionId, amount } = event.args;

    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId: Number(positionId) },
      include: { pool: true },
    });

    if (!position) {
      return; // Position will be created by PositionCreated event
    }

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block ? new Date(block.timestamp * 1000) : new Date();

    const amountDecimal = parseFloat(ethers.formatUnits(amount, position.pool.assetDecimals));

    // Create interest payment transaction
    await this.prisma.transaction.create({
      data: {
        txHash: `${event.transactionHash}-interest`,
        userId: position.userId,
        poolId: position.poolId,
        chainId,
        type: 'INTEREST_PAYMENT',
        status: TxStatus.CONFIRMED,
        amount: amountDecimal,
        timestamp,
        blockNumber: BigInt(event.blockNumber),
        lockedPositionId: Number(positionId),
      },
    });

    // Update analytics
    await this.prisma.poolAnalytics.update({
      where: { poolId: position.poolId },
      data: {
        totalInterestPaid: { increment: amountDecimal },
      },
    });

    this.logger.log(`💵 Upfront interest ${amountDecimal} paid for position ${positionId}`);
  }

  // ============================================================================
  // INDEXER STATE MANAGEMENT
  // ============================================================================

  private async getLastCheckedBlock(chainId: number): Promise<number | null> {
    const state = await this.prisma.indexerState.findUnique({
      where: { chainId_indexerType: { chainId, indexerType: 'LOCKED_POSITION' } },
    });
    return state ? state.lastBlock : null;
  }

  private async updateLastCheckedBlock(chainId: number, blockNumber: number) {
    await this.prisma.indexerState.upsert({
      where: { chainId_indexerType: { chainId, indexerType: 'LOCKED_POSITION' } },
      update: { lastBlock: blockNumber },
      create: { chainId, indexerType: 'LOCKED_POSITION', lastBlock: blockNumber },
    });
  }
}

