import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { FeesService } from './fees.service';

@Controller('fees')
export class FeesController {
  private readonly logger = new Logger(FeesController.name);

  constructor(private readonly feesService: FeesService) {}

  /**
   * Get fee split configuration for a specific fee type
   */
  @Get('split')
  async getFeeSplit(
    @Query('feeType') feeType?: string,
    @Query('chainId') chainId?: string,
  ) {
    this.logger.log(`GET /fees/split`);
    return this.feesService.getFeeSplit(
      feeType ? parseInt(feeType) : undefined,
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get all fee splits for all fee types
   */
  @Get('splits')
  async getAllFeeSplits(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /fees/splits`);
    return this.feesService.getAllFeeSplits(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get protocol fees summary
   */
  @Get('summary')
  async getProtocolFeesSummary(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /fees/summary`);
    return this.feesService.getProtocolFeesSummary(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get fee statistics for a specific asset
   */
  @Get('asset/:assetAddress')
  async getAssetFeeStats(
    @Param('assetAddress') assetAddress: string,
    @Query('chainId') chainId?: string,
  ) {
    this.logger.log(`GET /fees/asset/${assetAddress}`);
    return this.feesService.getAssetFeeStats(
      assetAddress,
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get pending distributions for a specific asset
   */
  @Get('pending/:assetAddress')
  async getPendingDistributions(
    @Param('assetAddress') assetAddress: string,
    @Query('chainId') chainId?: string,
  ) {
    this.logger.log(`GET /fees/pending/${assetAddress}`);
    return this.feesService.getPendingDistributions(
      assetAddress,
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get pending distributions for all tracked assets
   */
  @Get('pending')
  async getAllPendingDistributions(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /fees/pending`);
    return this.feesService.getAllPendingDistributions(
      chainId ? parseInt(chainId) : undefined,
    );
  }

  /**
   * Get effective deposit fee for a pool
   */
  @Get('pool/:poolAddress')
  async getPoolDepositFee(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /fees/pool/${poolAddress}`);
    return this.feesService.getPoolDepositFee(poolAddress);
  }

  /**
   * Get all fee rates for a pool
   */
  @Get('pool/:poolAddress/rates')
  async getPoolFeeRates(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /fees/pool/${poolAddress}/rates`);
    return this.feesService.getPoolFeeRates(poolAddress);
  }

  /**
   * Calculate deposit fee for a specific amount
   */
  @Get('calculate')
  async calculateDepositFee(
    @Query('poolAddress') poolAddress: string,
    @Query('amount') amount: string,
  ) {
    this.logger.log(`GET /fees/calculate for ${amount} in ${poolAddress}`);
    return this.feesService.calculateDepositFee(poolAddress, amount);
  }

  /**
   * Get fee analytics across all pools
   */
  @Get('analytics')
  async getFeeAnalytics(@Query('chainId') chainId?: string) {
    this.logger.log(`GET /fees/analytics`);
    return this.feesService.getFeeAnalytics(
      chainId ? parseInt(chainId) : undefined,
    );
  }
}
