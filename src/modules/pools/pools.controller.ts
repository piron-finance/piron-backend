import {
  Controller,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PoolsService } from './pools.service';
import { PoolQueryDto } from './dtos/pool-query.dto';

@Controller('pools')
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: PoolQueryDto) {
    return this.poolsService.findAll(query);
  }

  @Get('featured')
  @HttpCode(HttpStatus.OK)
  async getFeaturedPools() {
    return this.poolsService.getFeaturedPools();
  }

  @Get(':poolAddress')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('poolAddress') poolAddress: string) {
    return this.poolsService.findOne(poolAddress);
  }

  @Get(':poolAddress/stats')
  @HttpCode(HttpStatus.OK)
  async getPoolStats(@Param('poolAddress') poolAddress: string) {
    return this.poolsService.getPoolStats(poolAddress);
  }

  /**
   * Get lock tiers for a locked pool
   */
  @Get(':poolAddress/tiers')
  @HttpCode(HttpStatus.OK)
  async getPoolTiers(@Param('poolAddress') poolAddress: string) {
    return this.poolsService.getPoolTiers(poolAddress);
  }

  /**
   * Get live metrics for a locked pool from blockchain
   */
  @Get(':chainId/:poolAddress/locked-metrics')
  @HttpCode(HttpStatus.OK)
  async getLockedPoolMetrics(
    @Param('chainId', ParseIntPipe) chainId: number,
    @Param('poolAddress') poolAddress: string,
  ) {
    return this.poolsService.getLockedPoolMetrics(chainId, poolAddress);
  }

  /**
   * Preview locked deposit interest calculation
   */
  @Get(':chainId/:poolAddress/preview-locked')
  @HttpCode(HttpStatus.OK)
  async previewLockedDeposit(
    @Param('chainId', ParseIntPipe) chainId: number,
    @Param('poolAddress') poolAddress: string,
    @Query('amount') amount: string,
    @Query('tierIndex', ParseIntPipe) tierIndex: number,
  ) {
    return this.poolsService.previewLockedDeposit(chainId, poolAddress, amount, tierIndex);
  }
}
