import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PoolStatus, PoolType, LockedPositionStatus } from '@prisma/client';
import {
  CreateWithdrawalDto,
  RedeemLockedPositionDto,
  EarlyExitDto,
  SetAutoRolloverDto,
  TransferPositionDto,
} from './dtos/withdrawal.dto';
import { ethers } from 'ethers';
import LiquidityPoolABI from '../../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../../contracts/abis/StableYieldPool.json';
import LockedPoolABI from '../../contracts/abis/LockedPool.json';

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  /**
   * Build withdrawal transaction for Single-Asset or Stable Yield pools
   */
  async buildWithdrawalTransaction(dto: CreateWithdrawalDto) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: dto.poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${dto.poolAddress}`);
    }

    if (pool.poolType === PoolType.LOCKED) {
      throw new BadRequestException(
        'Use /withdrawals/redeem or /withdrawals/early-exit for Locked pools',
      );
    }

    const amountBigInt = BigInt(
      Math.floor(parseFloat(dto.amount) * 10 ** pool.assetDecimals),
    );

    if (pool.poolType === PoolType.SINGLE_ASSET) {
      return this.buildSingleAssetWithdrawal(pool, amountBigInt, dto.receiver);
    } else if (pool.poolType === PoolType.STABLE_YIELD) {
      return this.buildStableYieldWithdrawal(pool, amountBigInt, dto.receiver);
    }

    throw new BadRequestException(`Unsupported pool type: ${pool.poolType}`);
  }

  /**
   * Build redemption transaction for matured locked positions
   */
  async buildRedeemTransaction(dto: RedeemLockedPositionDto) {
    const position = await this.getAndValidateLockedPosition(dto.positionId);

    if (
      position.status !== LockedPositionStatus.ACTIVE &&
      position.status !== LockedPositionStatus.MATURED
    ) {
      throw new BadRequestException(
        `Position ${dto.positionId} is not redeemable (status: ${position.status})`,
      );
    }

    const now = Date.now();
    const isMatured = now >= position.lockEndTime.getTime();

    if (!isMatured && position.status !== LockedPositionStatus.MATURED) {
      throw new BadRequestException(
        `Position ${dto.positionId} has not matured yet. Use early exit instead.`,
      );
    }

    const lockedPoolIface = new ethers.Interface(LockedPoolABI);
    const data = lockedPoolIface.encodeFunctionData('redeemPosition', [
      dto.positionId,
    ]);

    return {
      to: dto.poolAddress,
      data,
      value: '0',
      chainId: position.pool.chainId,
      metadata: {
        type: 'LOCKED_REDEEM',
        poolName: position.pool.name,
        positionId: dto.positionId,
        principal: position.principal.toString(),
        expectedPayout: position.expectedMaturityPayout.toString(),
        interestEarned: position.interest.toString(),
        lockDuration: `${position.tier.durationDays} days`,
        tierAPY: `${(position.tier.apyBps / 100).toFixed(2)}%`,
      },
    };
  }

  /**
   * Build early exit transaction for active locked positions
   */
  async buildEarlyExitTransaction(dto: EarlyExitDto) {
    const position = await this.getAndValidateLockedPosition(dto.positionId);

    if (position.status !== LockedPositionStatus.ACTIVE) {
      throw new BadRequestException(
        `Position ${dto.positionId} is not active (status: ${position.status})`,
      );
    }

    // Get early exit preview from blockchain
    let earlyExitPreview;
    try {
      earlyExitPreview = await this.blockchain.calculateEarlyExitPayout(
        position.pool.chainId,
        dto.positionId,
      );
    } catch {
      earlyExitPreview = this.calculateFallbackEarlyExit(position);
    }

    const lockedPoolIface = new ethers.Interface(LockedPoolABI);
    const data = lockedPoolIface.encodeFunctionData('earlyExit', [
      dto.positionId,
    ]);

    const decimals = position.pool.assetDecimals;

    return {
      to: dto.poolAddress,
      data,
      value: '0',
      chainId: position.pool.chainId,
      metadata: {
        type: 'LOCKED_EARLY_EXIT',
        poolName: position.pool.name,
        positionId: dto.positionId,
        principal: position.principal.toString(),
        daysElapsed: earlyExitPreview.daysElapsed.toString(),
        daysRemaining:
          position.tier.durationDays - Number(earlyExitPreview.daysElapsed),
        penalty: (
          Number(earlyExitPreview.penalty) /
          10 ** decimals
        ).toString(),
        penaltyPercent: `${(position.tier.earlyExitPenaltyBps / 100).toFixed(2)}%`,
        proRataInterest: (
          Number(earlyExitPreview.proRataInterest) /
          10 ** decimals
        ).toString(),
        estimatedPayout: (
          Number(earlyExitPreview.payout) /
          10 ** decimals
        ).toString(),
        warning:
          'Early exit incurs a penalty and forfeits some accrued interest',
      },
    };
  }

  /**
   * Build transaction to enable/disable auto-rollover for locked position
   */
  async buildSetAutoRolloverTransaction(dto: SetAutoRolloverDto) {
    const position = await this.getAndValidateLockedPosition(dto.positionId);

    if (position.status !== LockedPositionStatus.ACTIVE) {
      throw new BadRequestException(
        `Position ${dto.positionId} is not active (status: ${position.status})`,
      );
    }

    const newTierIndex = dto.newTierIndex ?? position.tier.tierIndex;

    // Validate new tier exists if specified
    if (dto.newTierIndex !== undefined) {
      const tier = await this.prisma.lockTier.findFirst({
        where: {
          poolId: position.poolId,
          tierIndex: dto.newTierIndex,
          isActive: true,
        },
      });

      if (!tier) {
        throw new BadRequestException(
          `Tier ${dto.newTierIndex} not found or inactive`,
        );
      }
    }

    const lockedPoolIface = new ethers.Interface(LockedPoolABI);
    const data = lockedPoolIface.encodeFunctionData('setAutoRollover', [
      dto.positionId,
      newTierIndex,
    ]);

    return {
      to: dto.poolAddress,
      data,
      value: '0',
      chainId: position.pool.chainId,
      metadata: {
        type: 'SET_AUTO_ROLLOVER',
        poolName: position.pool.name,
        positionId: dto.positionId,
        currentAutoRollover: position.autoRollover,
        newAutoRollover: !position.autoRollover,
        targetTierIndex: newTierIndex,
      },
    };
  }

  /**
   * Build transaction to transfer locked position to another address
   */
  async buildTransferPositionTransaction(dto: TransferPositionDto) {
    const position = await this.getAndValidateLockedPosition(dto.positionId);

    if (
      position.status !== LockedPositionStatus.ACTIVE &&
      position.status !== LockedPositionStatus.MATURED
    ) {
      throw new BadRequestException(
        `Position ${dto.positionId} cannot be transferred (status: ${position.status})`,
      );
    }

    if (!ethers.isAddress(dto.toAddress)) {
      throw new BadRequestException(`Invalid recipient address: ${dto.toAddress}`);
    }

    const lockedPoolIface = new ethers.Interface(LockedPoolABI);
    const data = lockedPoolIface.encodeFunctionData('transferPosition', [
      dto.positionId,
      dto.toAddress,
    ]);

    return {
      to: dto.poolAddress,
      data,
      value: '0',
      chainId: position.pool.chainId,
      metadata: {
        type: 'TRANSFER_POSITION',
        poolName: position.pool.name,
        positionId: dto.positionId,
        toAddress: dto.toAddress,
        principal: position.principal.toString(),
        expectedPayout: position.expectedMaturityPayout.toString(),
        lockEndTime: position.lockEndTime.toISOString(),
        warning:
          'Transferring position will change ownership. This action cannot be undone.',
      },
    };
  }

  /**
   * Get withdrawal queue status for a user in a Stable Yield pool
   */
  async getWithdrawalQueueStatus(poolAddress: string, userAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    if (pool.poolType !== PoolType.STABLE_YIELD) {
      throw new BadRequestException('Withdrawal queue only applies to Stable Yield pools');
    }

    try {
      const queueStatus = await this.blockchain.getWithdrawalQueuePosition(
        pool.chainId,
        poolAddress,
        userAddress,
      );

      return {
        poolAddress,
        userAddress,
        hasPendingRequest: queueStatus.hasPending,
        requestedShares: queueStatus.shares?.toString() || '0',
        estimatedAssets: queueStatus.assets?.toString() || '0',
        queuePosition: queueStatus.position || null,
        estimatedProcessingTime: queueStatus.hasPending
          ? 'Processed when liquidity is available'
          : null,
      };
    } catch {
      return {
        poolAddress,
        userAddress,
        hasPendingRequest: false,
        requestedShares: '0',
        estimatedAssets: '0',
        queuePosition: null,
        note: 'Unable to fetch queue status from blockchain',
      };
    }
  }

  /**
   * Preview withdrawal for any pool type
   */
  async previewWithdrawal(poolAddress: string, amount: string, userAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    const amountBigInt = BigInt(
      Math.floor(parseFloat(amount) * 10 ** pool.assetDecimals),
    );

    if (pool.poolType === PoolType.SINGLE_ASSET) {
      return this.previewSingleAssetWithdrawal(pool, amountBigInt, userAddress);
    } else if (pool.poolType === PoolType.STABLE_YIELD) {
      return this.previewStableYieldWithdrawal(pool, amountBigInt, userAddress);
    }

    throw new BadRequestException(
      `Use specific position endpoints for ${pool.poolType} pools`,
    );
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async buildSingleAssetWithdrawal(
    pool: any,
    amount: bigint,
    receiver: string,
  ) {
    if (pool.status !== PoolStatus.FUNDING && pool.status !== PoolStatus.MATURED) {
      throw new BadRequestException(
        `Pool ${pool.name} is not accepting withdrawals (status: ${pool.status})`,
      );
    }

    const liquidityPoolIface = new ethers.Interface(LiquidityPoolABI);
    const data = liquidityPoolIface.encodeFunctionData('withdraw', [
      amount,
      receiver,
      receiver,
    ]);

    return {
      to: pool.poolAddress,
      data,
      value: '0',
      chainId: pool.chainId,
      metadata: {
        type: 'SINGLE_ASSET_WITHDRAWAL',
        poolName: pool.name,
        amount: (Number(amount) / 10 ** pool.assetDecimals).toString(),
        assetSymbol: pool.assetSymbol,
        receiver,
      },
    };
  }

  private async buildStableYieldWithdrawal(
    pool: any,
    shares: bigint,
    receiver: string,
  ) {
    // Note: For Stable Yield pools, withdrawals go through a queue
    // The amount here represents shares to redeem
    const stableYieldPoolIface = new ethers.Interface(StableYieldPoolABI);
    const data = stableYieldPoolIface.encodeFunctionData('requestWithdrawal', [
      shares,
      receiver,
    ]);

    return {
      to: pool.poolAddress,
      data,
      value: '0',
      chainId: pool.chainId,
      metadata: {
        type: 'STABLE_YIELD_WITHDRAWAL_REQUEST',
        poolName: pool.name,
        shares: shares.toString(),
        receiver,
        note: 'Withdrawal requests are queued and processed when liquidity is available',
      },
    };
  }

  private async getAndValidateLockedPosition(positionId: number) {
    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
            poolAddress: true,
            chainId: true,
            assetSymbol: true,
            assetDecimals: true,
            status: true,
          },
        },
        tier: true,
      },
    });

    if (!position) {
      throw new NotFoundException(`Locked position ${positionId} not found`);
    }

    return position;
  }

  private calculateFallbackEarlyExit(position: any) {
    const now = Date.now();
    const depositTime = position.depositTime.getTime();
    const daysElapsed = Math.floor((now - depositTime) / (1000 * 60 * 60 * 24));

    const principalNum = Number(position.principal);
    const penalty = (principalNum * position.tier.earlyExitPenaltyBps) / 10000;

    let proRataInterest = 0;
    if (position.interestPayment === 'AT_MATURITY') {
      proRataInterest =
        (Number(position.interest) * daysElapsed) / position.tier.durationDays;
    }

    const payout = principalNum - penalty + proRataInterest;

    return {
      daysElapsed: BigInt(daysElapsed),
      penalty: BigInt(Math.floor(penalty * 10 ** position.pool.assetDecimals)),
      proRataInterest: BigInt(
        Math.floor(proRataInterest * 10 ** position.pool.assetDecimals),
      ),
      payout: BigInt(Math.floor(payout * 10 ** position.pool.assetDecimals)),
    };
  }

  private async previewSingleAssetWithdrawal(
    pool: any,
    shares: bigint,
    userAddress: string,
  ) {
    try {
      const preview = await this.blockchain.previewWithdrawal(
        pool.chainId,
        pool.poolAddress,
        shares,
      );

      return {
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: 'SINGLE_ASSET',
        sharesToRedeem: shares.toString(),
        estimatedAssets: preview.assets.toString(),
        userAddress,
        withdrawalType: 'IMMEDIATE',
      };
    } catch {
      return {
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: 'SINGLE_ASSET',
        sharesToRedeem: shares.toString(),
        estimatedAssets: shares.toString(),
        userAddress,
        withdrawalType: 'IMMEDIATE',
        note: 'Estimate - verify on-chain before executing',
      };
    }
  }

  private async previewStableYieldWithdrawal(
    pool: any,
    shares: bigint,
    userAddress: string,
  ) {
    try {
      const navPerShare = await this.blockchain.getStableYieldNAV(
        pool.chainId,
        pool.poolAddress,
      );

      const estimatedAssets = (shares * navPerShare) / BigInt(10 ** 18);

      const queueStatus = await this.getWithdrawalQueueStatus(
        pool.poolAddress,
        userAddress,
      );

      return {
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: 'STABLE_YIELD',
        sharesToRedeem: shares.toString(),
        navPerShare: navPerShare.toString(),
        estimatedAssets: estimatedAssets.toString(),
        userAddress,
        withdrawalType: 'QUEUED',
        existingQueueRequest: queueStatus.hasPendingRequest,
        note: 'Stable Yield withdrawals are processed through a queue',
      };
    } catch {
      return {
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        poolType: 'STABLE_YIELD',
        sharesToRedeem: shares.toString(),
        estimatedAssets: shares.toString(),
        userAddress,
        withdrawalType: 'QUEUED',
        note: 'Unable to calculate exact assets - verify on-chain',
      };
    }
  }
}
