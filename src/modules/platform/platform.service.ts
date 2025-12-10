import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async getMetrics() {
    try {
      // Get all pools with analytics
      const pools = await this.prisma.pool.findMany({
        where: {
          isActive: true,
        },
        include: {
          analytics: true,
        },
      });

      // Calculate platform-wide metrics
      const totalValueLocked = pools.reduce(
        (sum, p) => sum + Number(p.analytics?.totalValueLocked || 0),
        0,
      );

      // Calculate 24h net flows
      const netFlows24h = pools.reduce((sum, p) => sum + Number(p.analytics?.volume24h || 0), 0);

      // Calculate weighted average APY (using same fallback logic as pools/positions)
      // weightedAPY = Σ(poolAPY * poolTVL) / Σ(poolTVL)
      const weightedAPYSum = pools.reduce((sum, p) => {
        const apy = Number(p.analytics?.apy || p.projectedAPY || 0);
        const tvl = Number(p.analytics?.totalValueLocked || 0);
        return sum + apy * tvl;
      }, 0);
      const averageAPY = totalValueLocked > 0 ? weightedAPYSum / totalValueLocked : 0;

      // Count active pools (all pools are already filtered by isActive)
      const activePools = pools.filter((p) => p.analytics !== null).length;

      // Get total user count
      const totalUsers = await this.prisma.user.count({
        where: { isActive: true },
      });

      // Get active users (users with positions)
      const activeUsers = await this.prisma.user.count({
        where: {
          isActive: true,
          poolPositions: {
            some: {
              isActive: true,
            },
          },
        },
      });

      // Get total transactions count
      const totalTransactions = await this.prisma.transaction.count();

      // Get total pools
      const totalPools = await this.prisma.pool.count();

      return {
        totalValueLocked: totalValueLocked.toString(),
        totalValueLockedFormatted: this.formatCurrency(totalValueLocked),
        tvlChange24h: netFlows24h.toString(),
        tvlChange24hPercentage:
          totalValueLocked > 0 ? ((netFlows24h / totalValueLocked) * 100).toFixed(2) : '0.00',
        netFlows24h: netFlows24h.toString(),
        netFlows24hFormatted: this.formatCurrency(netFlows24h),
        averageAPY: averageAPY.toFixed(2),
        activePools,
        totalPools,
        totalUsers,
        activeUsers,
        totalTransactions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Return empty metrics if error
      return {
        totalValueLocked: '0',
        totalValueLockedFormatted: '$0',
        tvlChange24h: '0',
        tvlChange24hPercentage: '0.00',
        netFlows24h: '0',
        netFlows24hFormatted: '$0',
        averageAPY: '0.00',
        activePools: 0,
        totalPools: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalTransactions: 0,
        timestamp: new Date().toISOString(),
      };
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
