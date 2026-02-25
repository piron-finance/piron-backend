import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { YieldReserveService } from './yield-reserve.service';

@Controller('yield-reserve')
export class YieldReserveController {
  private readonly logger = new Logger(YieldReserveController.name);

  constructor(private readonly yieldReserveService: YieldReserveService) {}

  /**
   * Get yield reserve statistics
   */
  @Get('stats')
  async getReserveStats(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /yield-reserve/stats`);
    return this.yieldReserveService.getReserveStats(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get protocol funds snapshot
   */
  @Get('snapshot')
  async getProtocolFundsSnapshot(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /yield-reserve/snapshot`);
    return this.yieldReserveService.getProtocolFundsSnapshot(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get reserve utilization metrics
   */
  @Get('utilization')
  async getReserveUtilization(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /yield-reserve/utilization`);
    return this.yieldReserveService.getReserveUtilization(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get all pools with active loans
   */
  @Get('loans')
  async getPoolsWithActiveLoans(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /yield-reserve/loans`);
    return this.yieldReserveService.getPoolsWithActiveLoans(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get protocol funds for a specific pool
   */
  @Get('pool/:poolAddress')
  async getPoolProtocolFunds(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /yield-reserve/pool/${poolAddress}`);
    return this.yieldReserveService.getPoolProtocolFunds(poolAddress);
  }

  /**
   * Get loan information for a pool
   */
  @Get('pool/:poolAddress/loan')
  async getPoolLoan(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /yield-reserve/pool/${poolAddress}/loan`);
    return this.yieldReserveService.getPoolLoan(poolAddress);
  }

  /**
   * Get debt positions summary for a pool
   */
  @Get('pool/:poolAddress/debt')
  async getPoolDebtSummary(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /yield-reserve/pool/${poolAddress}/debt`);
    return this.yieldReserveService.getPoolDebtSummary(poolAddress);
  }

  /**
   * Get reserve operations history for a pool
   */
  @Get('pool/:poolAddress/history')
  async getPoolReserveHistory(
    @Param('poolAddress') poolAddress: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /yield-reserve/pool/${poolAddress}/history`);
    return this.yieldReserveService.getPoolReserveHistory(
      poolAddress,
      limit ? parseInt(limit) : undefined,
    );
  }
}
