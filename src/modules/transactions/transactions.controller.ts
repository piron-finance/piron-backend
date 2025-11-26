import { Controller, Get, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionType, TxStatus } from '@prisma/client';

@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('users/:walletAddress/transactions')
  async getUserTransactions(
    @Param('walletAddress') walletAddress: string,
    @Query('poolId') poolId?: string,
    @Query('type') type?: TransactionType,
    @Query('status') status?: TxStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.getUserTransactions({
      walletAddress,
      poolId,
      type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('transactions/:txHash')
  async getTransactionByHash(@Param('txHash') txHash: string) {
    return this.transactionsService.getTransactionByHash(txHash);
  }

  @Get('pools/:poolAddress/transactions')
  async getPoolTransactions(
    @Param('poolAddress') poolAddress: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.getPoolTransactions(
      poolAddress,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
