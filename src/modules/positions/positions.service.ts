import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { LockedPositionStatus } from '@prisma/client';

@Injectable()
export class PositionsService {
  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  async getUserPositions(walletAddress: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new NotFoundException(`User with wallet ${walletAddress} not found`);
      }

      // Get all user positions (Single-Asset & Stable Yield) with enhanced pool data
      const positions = await this.prisma.poolPosition.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        include: {
          pool: {
            select: {
              id: true,
              name: true,
              poolType: true,
              poolAddress: true,
              assetSymbol: true,
              status: true,
              maturityDate: true,
              country: true,
              issuer: true,
              projectedAPY: true,
              analytics: {
                select: {
                  navPerShare: true,
                  apy: true,
                },
              },
            },
          },
        },
        orderBy: {
          currentValue: 'desc',
        },
      });

      // Get all locked positions
      const lockedPositions = await this.prisma.lockedPosition.findMany({
        where: {
          userId: user.id,
          status: { in: [LockedPositionStatus.ACTIVE, LockedPositionStatus.MATURED] },
        },
        include: {
          pool: {
            select: {
              id: true,
              name: true,
              poolType: true,
              poolAddress: true,
              assetSymbol: true,
              status: true,
              country: true,
              issuer: true,
            },
          },
          tier: true,
        },
        orderBy: {
          principal: 'desc',
        },
      });

      // Get last transactions for non-locked positions
      const poolIds = positions.map((p) => p.poolId);
      const lastTransactions = await this.prisma.transaction.findMany({
        where: {
          userId: user.id,
          poolId: { in: poolIds },
          status: 'CONFIRMED',
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
        },
        orderBy: { timestamp: 'desc' },
        distinct: ['poolId'],
        select: {
          poolId: true,
          timestamp: true,
          type: true,
        },
      });

      const transactionMap = new Map(lastTransactions.map((tx) => [tx.poolId, tx]));

      const positionsWithActivity = positions.map((pos) => ({
        ...pos,
        lastTransaction: transactionMap.get(pos.poolId) || null,
      }));

      // Calculate analytics for regular positions
      const regularTotalValue = positionsWithActivity.reduce(
        (sum, p) => sum + Number(p.currentValue),
        0,
      );
      const regularTotalDeposited = positionsWithActivity.reduce(
        (sum, p) => sum + Number(p.totalDeposited),
        0,
      );

      // Calculate analytics for locked positions
      const lockedTotalPrincipal = lockedPositions.reduce(
        (sum, p) => sum + Number(p.principal),
        0,
      );
      const lockedTotalInvested = lockedPositions.reduce(
        (sum, p) => sum + Number(p.investedAmount),
        0,
      );
      const lockedExpectedPayout = lockedPositions.reduce(
        (sum, p) => sum + Number(p.expectedMaturityPayout),
        0,
      );

      // Combined totals
      const totalValue = regularTotalValue + lockedTotalInvested;
      const totalDeposited = regularTotalDeposited + lockedTotalPrincipal;
      const totalReturn = totalValue - totalDeposited + (lockedExpectedPayout - lockedTotalPrincipal);
      const totalReturnPercentage = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0;

      // Calculate weighted average APY
      const weightedAPY =
        totalValue > 0
          ? positionsWithActivity.reduce((sum, p) => {
              const posValue = Number(p.currentValue);
              const poolAPY = Number(p.pool.analytics?.apy || p.pool.projectedAPY || 0);
              return sum + (posValue * poolAPY) / totalValue;
            }, 0) +
            lockedPositions.reduce((sum, p) => {
              const posValue = Number(p.investedAmount);
              const tierAPY = p.tier.apyBps / 100;
              return sum + (posValue * tierAPY) / totalValue;
            }, 0)
          : 0;

      return {
        analytics: {
          totalValue: totalValue.toString(),
          totalValueFormatted: this.formatCurrency(totalValue),
          totalDeposited: totalDeposited.toString(),
          totalReturn: totalReturn.toString(),
          totalReturnPercentage: totalReturnPercentage.toFixed(2),
          unrealizedReturn: totalReturn.toString(),
          realizedReturn: '0.00',
          activePositions: positionsWithActivity.length,
          activeLockedPositions: lockedPositions.length,
          averageAPY: weightedAPY.toFixed(2),
          // Locked specific
          lockedPrincipal: lockedTotalPrincipal.toString(),
          lockedExpectedPayout: lockedExpectedPayout.toString(),
        },
        positions: positionsWithActivity.map((pos) => {
          const daysHeld = pos.firstDepositTime
            ? Math.floor((Date.now() - pos.firstDepositTime.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return {
            id: pos.id,
            poolId: pos.poolId,
            positionType: 'POOL',
            pool: {
              id: pos.pool.id,
              name: pos.pool.name,
              poolType: pos.pool.poolType,
              poolAddress: pos.pool.poolAddress,
              assetSymbol: pos.pool.assetSymbol,
              status: pos.pool.status,
              apy: (pos.pool.analytics?.apy || pos.pool.projectedAPY || 0).toString(),
              navPerShare: pos.pool.analytics?.navPerShare?.toString() || null,
              maturityDate: pos.pool.maturityDate,
              country: pos.pool.country,
              issuer: pos.pool.issuer,
            },
            totalShares: pos.totalShares.toString(),
            totalDeposited: pos.totalDeposited.toString(),
            totalWithdrawn: pos.totalWithdrawn.toString(),
            currentValue: pos.currentValue.toString(),
            totalReturn: pos.totalReturn.toString(),
            totalReturnPercentage:
              Number(pos.totalDeposited) > 0
                ? ((Number(pos.totalReturn) / Number(pos.totalDeposited)) * 100).toFixed(2)
                : '0.00',
            unrealizedReturn: pos.unrealizedReturn.toString(),
            realizedReturn: pos.realizedReturn.toString(),
            firstDepositTime: pos.firstDepositTime,
            lastDepositTime: pos.lastDepositTime,
            daysHeld,
            lastActivityDate: pos.lastTransaction?.timestamp || pos.lastDepositTime,
            lastActivityType: pos.lastTransaction?.type || null,
            isActive: pos.isActive,
          };
        }),
        lockedPositions: lockedPositions.map((pos) => this.mapLockedPosition(pos)),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        `Error fetching positions for ${walletAddress}: ${error.message}`,
        error.stack,
      );

      return {
        analytics: {
          totalValue: '0',
          totalValueFormatted: '$0',
          totalDeposited: '0',
          totalReturn: '0',
          totalReturnPercentage: '0.00',
          unrealizedReturn: '0',
          realizedReturn: '0.00',
          activePositions: 0,
          activeLockedPositions: 0,
          averageAPY: '0.00',
          lockedPrincipal: '0',
          lockedExpectedPayout: '0',
        },
        positions: [],
        lockedPositions: [],
      };
    }
  }

  async getUserPositionInPool(walletAddress: string, poolAddress: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new NotFoundException(`User with wallet ${walletAddress} not found`);
      }

      const pool = await this.prisma.pool.findFirst({
        where: { poolAddress: poolAddress.toLowerCase() },
        select: {
          id: true,
          name: true,
          poolAddress: true,
          assetSymbol: true,
          poolType: true,
          status: true,
          maturityDate: true,
          country: true,
          issuer: true,
          projectedAPY: true,
          analytics: {
            select: {
              navPerShare: true,
              apy: true,
            },
          },
        },
      });

      if (!pool) {
        throw new NotFoundException(`Pool with address ${poolAddress} not found`);
      }

      const position = await this.prisma.poolPosition.findUnique({
        where: {
          userId_poolId: {
            userId: user.id,
            poolId: pool.id,
          },
        },
      });

      if (!position) {
        throw new NotFoundException(
          `No position found for user ${walletAddress} in pool ${poolAddress}`,
        );
      }

      const lastTransaction = await this.prisma.transaction.findFirst({
        where: {
          userId: user.id,
          poolId: pool.id,
          status: 'CONFIRMED',
          type: {
            in: ['DEPOSIT', 'WITHDRAWAL'],
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          timestamp: true,
          type: true,
        },
      });

      const daysHeld = position.firstDepositTime
        ? Math.floor((Date.now() - position.firstDepositTime.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: position.id,
        userId: position.userId,
        poolId: position.poolId,
        pool: {
          name: pool.name,
          poolAddress: pool.poolAddress,
          assetSymbol: pool.assetSymbol,
          poolType: pool.poolType,
          status: pool.status,
          apy: (pool.analytics?.apy || pool.projectedAPY || 0).toString(),
          navPerShare: pool.analytics?.navPerShare?.toString() || null,
          maturityDate: pool.maturityDate,
          country: pool.country,
          issuer: pool.issuer,
        },
        totalShares: position.totalShares.toString(),
        totalDeposited: position.totalDeposited.toString(),
        totalWithdrawn: position.totalWithdrawn.toString(),
        currentValue: position.currentValue.toString(),
        totalReturn: position.totalReturn.toString(),
        totalReturnPercentage:
          Number(position.totalDeposited) > 0
            ? ((Number(position.totalReturn) / Number(position.totalDeposited)) * 100).toFixed(2)
            : '0.00',
        unrealizedReturn: position.unrealizedReturn.toString(),
        realizedReturn: position.realizedReturn.toString(),
        couponsClaimed: position.couponsClaimed.toString(),
        pendingRefund: position.pendingRefund.toString(),
        discountAccrued: position.discountAccrued.toString(),
        firstDepositTime: position.firstDepositTime,
        lastDepositTime: position.lastDepositTime,
        lastWithdrawalTime: position.lastWithdrawalTime,
        daysHeld,
        lastActivityDate: lastTransaction?.timestamp || position.lastDepositTime,
        lastActivityType: lastTransaction?.type || null,
        isActive: position.isActive,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  // ============================================================================
  // LOCKED POSITIONS
  // ============================================================================

  /**
   * Get all locked positions for a user
   */
  async getUserLockedPositions(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`User with wallet ${walletAddress} not found`);
    }

    const lockedPositions = await this.prisma.lockedPosition.findMany({
      where: { userId: user.id },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
            poolType: true,
            poolAddress: true,
            assetSymbol: true,
            assetDecimals: true,
            chainId: true,
            status: true,
            country: true,
            issuer: true,
          },
        },
        tier: true,
      },
      orderBy: [{ status: 'asc' }, { lockEndTime: 'asc' }],
    });

    // Group by status for summary
    const active = lockedPositions.filter((p) => p.status === LockedPositionStatus.ACTIVE);
    const matured = lockedPositions.filter((p) => p.status === LockedPositionStatus.MATURED);
    const completed = lockedPositions.filter((p) =>
      p.status === LockedPositionStatus.REDEEMED ||
      p.status === LockedPositionStatus.EARLY_EXIT ||
      p.status === LockedPositionStatus.ROLLED_OVER,
    );

    const totalPrincipalLocked = active.reduce((sum, p) => sum + Number(p.principal), 0);
    const totalExpectedPayout = active.reduce((sum, p) => sum + Number(p.expectedMaturityPayout), 0);
    const totalInterestEarning = active.reduce((sum, p) => sum + Number(p.interest), 0);

    return {
      summary: {
        activeCount: active.length,
        maturedCount: matured.length,
        completedCount: completed.length,
        totalPrincipalLocked: totalPrincipalLocked.toString(),
        totalExpectedPayout: totalExpectedPayout.toString(),
        totalInterestEarning: totalInterestEarning.toString(),
        expectedReturn: (totalExpectedPayout - totalPrincipalLocked).toString(),
      },
      positions: lockedPositions.map((pos) => this.mapLockedPosition(pos)),
    };
  }

  /**
   * Get a specific locked position by ID
   */
  async getLockedPosition(positionId: number) {
    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
            poolType: true,
            poolAddress: true,
            assetSymbol: true,
            assetDecimals: true,
            chainId: true,
            status: true,
            country: true,
            issuer: true,
          },
        },
        tier: true,
        user: {
          select: {
            walletAddress: true,
          },
        },
      },
    });

    if (!position) {
      throw new NotFoundException(`Locked position ${positionId} not found`);
    }

    return this.mapLockedPositionDetail(position);
  }

  /**
   * Get locked positions for a specific pool
   */
  async getPoolLockedPositions(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool ${poolAddress} not found`);
    }

    if (pool.poolType !== 'LOCKED') {
      throw new Error('Pool is not a Locked pool');
    }

    const positions = await this.prisma.lockedPosition.findMany({
      where: { poolId: pool.id },
      include: {
        tier: true,
        user: {
          select: {
            walletAddress: true,
          },
        },
      },
      orderBy: { depositTime: 'desc' },
    });

    return positions.map((pos) => ({
      ...this.mapLockedPosition({ ...pos, pool }),
      userAddress: pos.user.walletAddress,
    }));
  }

  /**
   * Calculate early exit preview for a locked position
   */
  async previewEarlyExit(positionId: number) {
    const position = await this.prisma.lockedPosition.findUnique({
      where: { positionId },
      include: { pool: true, tier: true },
    });

    if (!position) {
      throw new NotFoundException(`Locked position ${positionId} not found`);
    }

    if (position.status !== LockedPositionStatus.ACTIVE) {
      throw new Error('Position is not active');
    }

    try {
      const earlyExitCalc = await this.blockchain.calculateEarlyExitPayout(
        position.pool.chainId,
        positionId,
      );

      return {
        positionId,
        principal: position.principal.toString(),
        interest: position.interest.toString(),
        interestPayment: position.interestPayment,
        daysElapsed: Number(earlyExitCalc.daysElapsed),
        daysRemaining: position.tier.durationDays - Number(earlyExitCalc.daysElapsed),
        penalty: (Number(earlyExitCalc.penalty) / 10 ** position.pool.assetDecimals).toString(),
        penaltyPercentage: ((Number(earlyExitCalc.penalty) / Number(position.principal)) * 100).toFixed(2),
        proRataInterest: (Number(earlyExitCalc.proRataInterest) / 10 ** position.pool.assetDecimals).toString(),
        estimatedPayout: (Number(earlyExitCalc.payout) / 10 ** position.pool.assetDecimals).toString(),
      };
    } catch (error) {
      // Fallback calculation if blockchain call fails
      const now = Date.now();
      const depositTime = position.depositTime.getTime();
      const daysElapsed = Math.floor((now - depositTime) / (1000 * 60 * 60 * 24));
      const penalty = (Number(position.principal) * position.tier.earlyExitPenaltyBps) / 10000;

      let proRataInterest = 0;
      if (position.interestPayment === 'AT_MATURITY') {
        proRataInterest = (Number(position.interest) * daysElapsed) / position.tier.durationDays;
      }

      const estimatedPayout = Number(position.principal) - penalty + proRataInterest;

      return {
        positionId,
        principal: position.principal.toString(),
        interest: position.interest.toString(),
        interestPayment: position.interestPayment,
        daysElapsed,
        daysRemaining: position.tier.durationDays - daysElapsed,
        penalty: penalty.toString(),
        penaltyPercentage: ((penalty / Number(position.principal)) * 100).toFixed(2),
        proRataInterest: proRataInterest.toString(),
        estimatedPayout: estimatedPayout.toString(),
        note: 'Estimate - verify on-chain before executing',
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private mapLockedPosition(pos: any) {
    const now = Date.now();
    const lockEnd = pos.lockEndTime.getTime();
    const depositTime = pos.depositTime.getTime();

    const daysElapsed = Math.floor((now - depositTime) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((lockEnd - now) / (1000 * 60 * 60 * 24)));
    const progressPercent = Math.min(100, (daysElapsed / pos.tier.durationDays) * 100);
    const isMatured = now >= lockEnd;

    return {
      id: pos.id,
      positionId: pos.positionId,
      positionType: 'LOCKED',
      pool: {
        id: pos.pool.id,
        name: pos.pool.name,
        poolType: pos.pool.poolType,
        poolAddress: pos.pool.poolAddress,
        assetSymbol: pos.pool.assetSymbol,
        status: pos.pool.status,
        country: pos.pool.country,
        issuer: pos.pool.issuer,
      },
      tier: {
        tierIndex: pos.tier.tierIndex,
        durationDays: pos.tier.durationDays,
        apyBps: pos.tier.apyBps,
        apyPercent: (pos.tier.apyBps / 100).toFixed(2),
        earlyExitPenaltyBps: pos.tier.earlyExitPenaltyBps,
        earlyExitPenaltyPercent: (pos.tier.earlyExitPenaltyBps / 100).toFixed(2),
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
      // Progress tracking
      daysElapsed,
      daysRemaining,
      progressPercent: progressPercent.toFixed(1),
      isMatured,
      // Exit info (if applicable)
      actualPayout: pos.actualPayout?.toString() || null,
      penaltyPaid: pos.penaltyPaid?.toString() || null,
      exitTime: pos.exitTime,
    };
  }

  private mapLockedPositionDetail(pos: any) {
    const base = this.mapLockedPosition(pos);
    return {
      ...base,
      chainId: pos.pool.chainId,
      assetDecimals: pos.pool.assetDecimals,
      userAddress: pos.user.walletAddress,
      depositTxHash: pos.depositTxHash,
      exitTxHash: pos.exitTxHash,
      proRataInterest: pos.proRataInterest?.toString() || null,
      rolledFromPositionId: pos.rolledFromPositionId,
      rolledToPositionId: pos.rolledToPositionId,
      createdAt: pos.createdAt,
      updatedAt: pos.updatedAt,
    };
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
  }
}
