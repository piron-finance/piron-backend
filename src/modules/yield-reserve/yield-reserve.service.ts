import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class YieldReserveService {
  private readonly logger = new Logger(YieldReserveService.name);
  private readonly defaultChainId = 84532; // Base Sepolia

  constructor(
    private blockchain: BlockchainService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get yield reserve statistics
   */
  async getReserveStats(chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const stats = await this.blockchain.getYieldReserveStats(chain);

    return {
      chainId: chain,
      balance: stats.balance.toString(),
      loaned: stats.loaned.toString(),
      invested: stats.invested.toString(),
      yieldReceived: stats.yieldReceived.toString(),
      sentToTreasury: stats.sentToTreasury.toString(),
      lossesAbsorbed: stats.lossesAbsorbed.toString(),
      availableForLoans: (stats.balance - stats.loaned).toString(),
    };
  }

  /**
   * Get protocol funds snapshot across the platform
   */
  async getProtocolFundsSnapshot(chainId?: number) {
    const chain = chainId || this.defaultChainId;
    const snapshot = await this.blockchain.getProtocolFundsSnapshot(chain);

    return {
      chainId: chain,
      reserveBalance: snapshot.reserveBalance.toString(),
      totalDeployedViaReserve: snapshot.totalDeployedViaReserve.toString(),
      totalDirectDeposits: snapshot.totalDirectDeposits.toString(),
      totalEarlyExitLoans: snapshot.totalEarlyExitLoans.toString(),
      grandTotal: snapshot.grandTotal.toString(),
      poolCount: Number(snapshot.poolCount),
    };
  }

  /**
   * Get protocol funds deployed to a specific pool
   */
  async getPoolProtocolFunds(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    const funds = await this.blockchain.getYieldReservePoolFunds(
      pool.chainId,
      poolAddress,
    );

    return {
      poolAddress,
      poolName: pool.name,
      poolType: pool.poolType,
      chainId: pool.chainId,
      fromReserve: funds.fromReserve.toString(),
      directDeposit: funds.directDeposit.toString(),
      earlyExitLoan: funds.earlyExitLoan.toString(),
      total: funds.total.toString(),
    };
  }

  /**
   * Get loan information for a pool (from early exits)
   */
  async getPoolLoan(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    const loanAmount = await this.blockchain.getPoolLoan(
      pool.chainId,
      poolAddress,
    );

    return {
      poolAddress,
      poolName: pool.name,
      chainId: pool.chainId,
      hasActiveLoan: loanAmount > BigInt(0),
      loanAmount: loanAmount.toString(),
    };
  }

  /**
   * Get all pools with active loans from the yield reserve
   */
  async getPoolsWithActiveLoans(chainId?: number) {
    const chain = chainId || this.defaultChainId;

    // Get all locked pools from database
    const lockedPools = await this.prisma.pool.findMany({
      where: {
        chainId: chain,
        poolType: 'LOCKED',
      },
      select: {
        poolAddress: true,
        name: true,
      },
    });

    // Check each pool for active loans
    const poolsWithLoans = [];

    for (const pool of lockedPools) {
      try {
        const loanAmount = await this.blockchain.getPoolLoan(
          chain,
          pool.poolAddress,
        );

        if (loanAmount > BigInt(0)) {
          poolsWithLoans.push({
            poolAddress: pool.poolAddress,
            poolName: pool.name,
            loanAmount: loanAmount.toString(),
          });
        }
      } catch {
        // Skip pools where loan check fails
      }
    }

    return {
      chainId: chain,
      activeLoansCount: poolsWithLoans.length,
      totalLoanedAmount: poolsWithLoans
        .reduce((sum, p) => sum + BigInt(p.loanAmount), BigInt(0))
        .toString(),
      pools: poolsWithLoans,
    };
  }

  /**
   * Get reserve utilization metrics
   */
  async getReserveUtilization(chainId?: number) {
    const chain = chainId || this.defaultChainId;

    const stats = await this.blockchain.getYieldReserveStats(chain);

    const totalCapacity = stats.balance + stats.loaned + stats.invested;
    const utilized = stats.loaned + stats.invested;

    const utilizationRate =
      totalCapacity > BigInt(0)
        ? Number((utilized * BigInt(10000)) / totalCapacity) / 100
        : 0;

    return {
      chainId: chain,
      totalCapacity: totalCapacity.toString(),
      balance: stats.balance.toString(),
      loaned: stats.loaned.toString(),
      invested: stats.invested.toString(),
      available: (stats.balance - stats.loaned).toString(),
      utilizationRatePercent: utilizationRate.toFixed(2),
      yieldReceived: stats.yieldReceived.toString(),
    };
  }

  /**
   * Get historical reserve operations for a pool (from database)
   */
  async getPoolReserveHistory(poolAddress: string, limit = 20) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    // Get SPV operations for this pool
    const operations = await this.prisma.sPVOperation.findMany({
      where: {
        poolId: pool.id,
      },
      orderBy: { initiatedAt: 'desc' },
      take: limit,
    });

    return {
      poolAddress,
      poolName: pool.name,
      operations: operations.map((op) => ({
        id: op.id,
        type: op.operationType,
        amount: op.amount.toString(),
        initiatedAt: op.initiatedAt.toISOString(),
        completedAt: op.completedAt?.toISOString() || null,
        status: op.status,
        txHash: op.txHash,
      })),
    };
  }

  /**
   * Get debt positions summary for a pool
   */
  async getPoolDebtSummary(poolAddress: string) {
    const pool = await this.prisma.pool.findFirst({
      where: { poolAddress: poolAddress.toLowerCase() },
    });

    if (!pool) {
      throw new NotFoundException(`Pool not found: ${poolAddress}`);
    }

    if (pool.poolType !== 'LOCKED') {
      throw new Error('Debt positions only apply to Locked pools');
    }

    const debtPositions = await this.blockchain.getPoolDebtPositionDetails(
      pool.chainId,
      poolAddress,
    );

    const unsettled = debtPositions.filter((p) => !p.settled);
    const settled = debtPositions.filter((p) => p.settled);

    const totalUnsettledDebt = unsettled.reduce(
      (sum, p) => sum + p.amountOwed,
      BigInt(0),
    );
    const totalReserveLoanOutstanding = unsettled.reduce(
      (sum, p) => sum + p.reserveLoan,
      BigInt(0),
    );

    return {
      poolAddress,
      poolName: pool.name,
      chainId: pool.chainId,
      totalPositions: debtPositions.length,
      unsettledCount: unsettled.length,
      settledCount: settled.length,
      totalUnsettledDebt: totalUnsettledDebt.toString(),
      totalReserveLoanOutstanding: totalReserveLoanOutstanding.toString(),
      positions: unsettled.map((p) => ({
        positionId: p.positionId.toString(),
        user: p.user,
        amountOwed: p.amountOwed.toString(),
        reserveLoan: p.reserveLoan.toString(),
        pendingPenalty: p.pendingPenalty.toString(),
        exitTime: new Date(Number(p.exitTime) * 1000).toISOString(),
      })),
    };
  }
}
