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

      // Get all user positions
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
              analytics: {
                select: {
                  navPerShare: true,
                },
              },
            },
          },
        },
      });

      // Calculate totals
      const totalValue = positions.reduce((sum, p) => sum + Number(p.currentValue), 0);
      const totalDeposited = positions.reduce((sum, p) => sum + Number(p.totalDeposited), 0);
      const totalReturn = totalValue - totalDeposited;
      const totalReturnPercentage = totalDeposited > 0 ? (totalReturn / totalDeposited) * 100 : 0;

      return {
        totalValue: totalValue.toString(),
        totalValueFormatted: this.formatCurrency(totalValue),
        totalDeposited: totalDeposited.toString(),
        totalReturn: totalReturn.toString(),
        totalReturnPercentage: totalReturnPercentage.toFixed(2),
        unrealizedReturn: totalReturn.toString(), // TODO: Split realized vs unrealized
        realizedReturn: '0.00',
        positions: positions.map((pos) => ({
          id: pos.id,
          poolId: pos.poolId,
          pool: {
            id: pos.pool.id,
            name: pos.pool.name,
            poolType: pos.pool.poolType,
            poolAddress: pos.pool.poolAddress,
            assetSymbol: pos.pool.assetSymbol,
            status: pos.pool.status,
            navPerShare: pos.pool.analytics?.navPerShare?.toString() || null,
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
          isActive: pos.isActive,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Return empty portfolio on error
      return {
        totalValue: '0',
        totalValueFormatted: '$0',
        totalDeposited: '0',
        totalReturn: '0',
        totalReturnPercentage: '0.00',
        unrealizedReturn: '0',
        realizedReturn: '0',
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

      // Get pool
      const pool = await this.prisma.pool.findFirst({
        where: { poolAddress: poolAddress.toLowerCase() },
        include: {
          analytics: {
            select: {
              navPerShare: true,
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

      return {
        id: position.id,
        userId: position.userId,
        poolId: position.poolId,
        pool: {
          name: pool.name,
          poolAddress: pool.poolAddress,
          assetSymbol: pool.assetSymbol,
          poolType: pool.poolType,
          navPerShare: pool.analytics?.navPerShare?.toString() || null,
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
