import { Controller, Get, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
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
}
