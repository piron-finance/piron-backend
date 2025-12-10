import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  async getUserPositions(walletAddress: string) {
    try {
      // Get user
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new NotFoundException(`User with wallet ${walletAddress} not found`);
      }

      // Get all user positions with enhanced pool data
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

      // Get all last transactions in a SINGLE query (optimized, not N+1)
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

      // Create a map for O(1) lookup
      const transactionMap = new Map(
        lastTransactions.map((tx) => [tx.poolId, tx]),
      );

      // Map positions with their last transaction
      const positionsWithActivity = positions.map((pos) => ({
        ...pos,
        lastTransaction: transactionMap.get(pos.poolId) || null,
      }));

      // Calculate analytics
      const totalValue = positionsWithActivity.reduce((sum, p) => sum + Number(p.currentValue), 0);
      const totalDeposited = positionsWithActivity.reduce((sum, p) => sum + Number(p.totalDeposited), 0);
      const totalReturn = totalValue - totalDeposited;
      const totalReturnPercentage = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0;
      const activePositions = positionsWithActivity.length;

      // Calculate weighted average APY (using same logic as pools service)
      const weightedAPY =
        totalValue > 0
          ? positionsWithActivity.reduce((sum, p) => {
              const posValue = Number(p.currentValue);
              const poolAPY = Number(p.pool.analytics?.apy || p.pool.projectedAPY || 0);
              return sum + (posValue * poolAPY) / totalValue;
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
          activePositions,
          averageAPY: weightedAPY.toFixed(2),
        },
        positions: positionsWithActivity.map((pos) => {
          const daysHeld = pos.firstDepositTime
            ? Math.floor((Date.now() - pos.firstDepositTime.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return {
            id: pos.id,
            poolId: pos.poolId,
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
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Log error for monitoring
      console.error(
        `Error fetching positions for ${walletAddress}: ${error.message}`,
        error.stack,
      );
      
      // Return empty portfolio on error (consider throwing in production)
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
          averageAPY: '0.00',
        },
        positions: [],
      };
    }
  }

  async getUserPositionInPool(walletAddress: string, poolAddress: string) {
    try {
      // Get user
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new NotFoundException(`User with wallet ${walletAddress} not found`);
      }

      // Get pool with enhanced data
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

      // Get position
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

      // Get last activity
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

  private formatCurrency(amount: number): string {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
  }
}
