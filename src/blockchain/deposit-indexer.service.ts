import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma.service';
import { UserType, TxStatus } from '@prisma/client';
import LiquidityPoolABI from '../contracts/abis/LiquidityPool.json';
import StableYieldPoolABI from '../contracts/abis/StableYieldPool.json';

@Injectable()
export class DepositIndexer implements OnModuleInit {
  private readonly logger = new Logger(DepositIndexer.name);
  private isRunning = false;
  private readonly pollingInterval = 12000;

  constructor(private blockchain: BlockchainService, private prisma: PrismaService) {}

  onModuleInit() {
    this.start();
  }

  start() {
    if (this.isRunning) {
      this.logger.warn('Deposit indexer already running');
      return;
    }
    this.isRunning = true;
    this.logger.log('💰 Deposit indexer started');
    this.pollForDeposits(84532);
  }

  stop() {
    this.isRunning = false;
    this.logger.log('Deposit indexer stopped');
  }

  private async pollForDeposits(chainId: number) {
    while (this.isRunning) {
      try {
        await this.indexDeposits(chainId);
      } catch (error) {
        this.logger.error(`Error in deposit indexer: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
    }
  }

  private async indexDeposits(chainId: number) {
    const pools = await this.prisma.pool.findMany({
      where: {
        chainId,
        isActive: true,
        poolAddress: { not: '' },
      },
    });

    const provider = this.blockchain.getProvider(chainId);
    const currentBlock = await provider.getBlockNumber();
    const lastCheckedBlock = (await this.getLastCheckedBlock(chainId)) || currentBlock - 100;

    if (currentBlock <= lastCheckedBlock) {
      return;
    }

    const fromBlock = lastCheckedBlock + 1;
    const toBlock = currentBlock;

    this.logger.debug(`Checking deposits from block ${fromBlock} to ${toBlock}`);

    for (const pool of pools) {
      await this.indexPoolDeposits(chainId, pool, fromBlock, toBlock);
    }

    await this.updateLastCheckedBlock(chainId, toBlock);
  }

  private async indexPoolDeposits(chainId: number, pool: any, fromBlock: number, toBlock: number) {
    try {
      const poolABI = pool.poolType === 'STABLE_YIELD' ? StableYieldPoolABI : LiquidityPoolABI;
      const poolContract = this.blockchain.getContract(chainId, pool.poolAddress, poolABI);

      const depositFilter = poolContract.filters.Deposit();
      const events = await poolContract.queryFilter(depositFilter, fromBlock, toBlock);

      for (const event of events) {
        await this.handleDepositEvent(chainId, pool, event as ethers.EventLog);
      }
    } catch (error) {
      this.logger.error(`Error indexing deposits for pool ${pool.poolAddress}: ${error.message}`);
    }
  }

  private async handleDepositEvent(chainId: number, pool: any, event: ethers.EventLog) {
    const { sender, owner, assets, shares } = event.args;

    this.logger.log(
      `💰 Deposit detected: ${ethers.formatUnits(assets, pool.assetDecimals)} ${
        pool.assetSymbol
      } to ${pool.name}`,
    );

    const existingTx = await this.prisma.transaction.findUnique({
      where: { txHash: event.transactionHash },
    });

    if (existingTx) {
      this.logger.debug(`Transaction ${event.transactionHash} already indexed`);
      return;
    }

    const provider = this.blockchain.getProvider(chainId);
    const block = await provider.getBlock(event.blockNumber);
    if (!block) {
      this.logger.error(`Block ${event.blockNumber} not found for tx ${event.transactionHash}`);
      return;
    }
    const timestamp = new Date(block.timestamp * 1000);

    const user = await this.prisma.user.upsert({
      where: { walletAddress: owner.toLowerCase() },
      update: {},
      create: {
        walletAddress: owner.toLowerCase(),
        userType: UserType.REGULAR_USER,
      },
    });

    const assetsDecimal = ethers.formatUnits(assets, pool.assetDecimals);
    const sharesDecimal = ethers.formatUnits(shares, pool.assetDecimals);

    const position = await this.prisma.poolPosition.upsert({
      where: {
        userId_poolId: {
          userId: user.id,
          poolId: pool.id,
        },
      },
      update: {
        totalDeposited: {
          increment: parseFloat(assetsDecimal),
        },
        totalShares: {
          increment: parseFloat(sharesDecimal),
        },
        currentValue: {
          increment: parseFloat(assetsDecimal),
        },
        lastDepositTime: timestamp,
        isActive: true,
      },
      create: {
        userId: user.id,
        poolId: pool.id,
        totalDeposited: parseFloat(assetsDecimal),
        totalWithdrawn: 0,
        totalShares: parseFloat(sharesDecimal),
        currentValue: parseFloat(assetsDecimal),
        unrealizedReturn: 0,
        realizedReturn: 0,
        isActive: true,
        lastDepositTime: timestamp,
      },
    });

    await this.prisma.transaction.create({
      data: {
        txHash: event.transactionHash,
        userId: user.id,
        poolId: pool.id,
        chainId,
        type: 'DEPOSIT',
        status: TxStatus.CONFIRMED,
        amount: parseFloat(assetsDecimal),
        shares: parseFloat(sharesDecimal),
        timestamp,
        blockNumber: BigInt(event.blockNumber),
      },
    });

    const isNewInvestor =
      parseFloat(assetsDecimal) === parseFloat(position.totalDeposited.toString());

    await this.prisma.poolAnalytics.update({
      where: { poolId: pool.id },
      data: {
        totalValueLocked: {
          increment: parseFloat(assetsDecimal),
        },
        totalShares: {
          increment: parseFloat(sharesDecimal),
        },
        totalDeposits: {
          increment: parseFloat(assetsDecimal),
        },
        netFlow: {
          increment: parseFloat(assetsDecimal),
        },
        uniqueInvestors: isNewInvestor ? { increment: 1 } : undefined,
        depositors24h: { increment: 1 },
        volume24h: {
          increment: parseFloat(assetsDecimal),
        },
      },
    });

    this.logger.log(`✅ Deposit indexed: User ${owner.substring(0, 8)}... → ${pool.name}`);
  }

  private async getLastCheckedBlock(chainId: number): Promise<number | null> {
    const state = await this.prisma.indexerState.findUnique({
      where: { chainId_indexerType: { chainId, indexerType: 'DEPOSIT' } },
    });
    return state ? state.lastBlock : null;
  }

  private async updateLastCheckedBlock(chainId: number, blockNumber: number) {
    await this.prisma.indexerState.upsert({
      where: { chainId_indexerType: { chainId, indexerType: 'DEPOSIT' } },
      update: { lastBlock: blockNumber },
      create: { chainId, indexerType: 'DEPOSIT', lastBlock: blockNumber },
    });
  }
}
