import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TransactionType, TxStatus } from '@prisma/client';

interface TransactionQueryDto {
  walletAddress: string;
  poolId?: string;
  type?: TransactionType;
  status?: TxStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getUserTransactions(query: TransactionQueryDto) {
    const { walletAddress, poolId, type, status, page = 1, limit = 20 } = query;

    try {
      // Get user
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });

      if (!user) {
        throw new NotFoundException(`User with wallet ${walletAddress} not found`);
      }

      // Build where clause
      const where = {
        userId: user.id,
        ...(poolId && { poolId }),
        ...(type && { type }),
        ...(status && { status }),
      };

      // Get transactions and total count
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where,
          include: {
            pool: {
              select: {
                name: true,
                poolAddress: true,
                assetSymbol: true,
              },
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.transaction.count({ where }),
      ]);

      return {
        data: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount.toString(),
          shares: tx.shares?.toString() || null,
          fee: tx.fee?.toString() || null,
          txHash: tx.txHash,
          status: tx.status,
          poolId: tx.poolId,
          pool: tx.pool
            ? {
                name: tx.pool.name,
                poolAddress: tx.pool.poolAddress,
                assetSymbol: tx.pool.assetSymbol,
              }
            : null,
          from: tx.from,
          to: tx.to,
          blockNumber: tx.blockNumber.toString(),
          gasUsed: tx.gasUsed?.toString() || null,
          gasPrice: tx.gasPrice?.toString() || null,
          timestamp: tx.timestamp,
          createdAt: tx.createdAt,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Return empty on error
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }

  async getTransactionByHash(txHash: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { txHash: txHash.toLowerCase() },
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
              poolType: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with hash ${txHash} not found`);
      }

      return {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toString(),
        shares: transaction.shares?.toString() || null,
        fee: transaction.fee?.toString() || null,
        txHash: transaction.txHash,
        chainId: transaction.chainId,
        status: transaction.status,
        failureReason: transaction.failureReason,
        user: transaction.user,
        pool: transaction.pool,
        from: transaction.from,
        to: transaction.to,
        blockNumber: transaction.blockNumber.toString(),
        blockHash: transaction.blockHash,
        gasUsed: transaction.gasUsed?.toString() || null,
        gasPrice: transaction.gasPrice?.toString() || null,
        timestamp: transaction.timestamp,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async getPoolTransactions(poolAddress: string, page = 1, limit = 20) {
    try {
      // Get pool
      const pool = await this.prisma.pool.findFirst({
        where: { poolAddress: poolAddress.toLowerCase() },
      });

      if (!pool) {
        throw new NotFoundException(`Pool with address ${poolAddress} not found`);
      }

      // Get transactions
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { poolId: pool.id },
          include: {
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { poolId: pool.id } }),
      ]);

      return {
        data: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount.toString(),
          shares: tx.shares?.toString() || null,
          fee: tx.fee?.toString() || null,
          txHash: tx.txHash,
          status: tx.status,
          userWallet: tx.user.walletAddress,
          from: tx.from,
          to: tx.to,
          blockNumber: tx.blockNumber.toString(),
          timestamp: tx.timestamp,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }
}
