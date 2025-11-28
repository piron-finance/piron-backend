import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { SpvService } from './spv.service';
import { AllocateToSPVDto, AddInstrumentDto, MatureInstrumentDto } from './dtos/spv-operations.dto';

@Controller('spv')
export class SpvController {
  constructor(private readonly spvService: SpvService) {}

  @Post('pools/:poolAddress/allocate')
  async allocateToSPV(@Body() dto: AllocateToSPVDto) {
    return this.spvService.allocateToSPV(dto);
  }

  @Post('pools/:poolAddress/instruments/add')
  async addInstrument(@Body() dto: AddInstrumentDto) {
    return this.spvService.addInstrument(dto);
  }

  @Post('pools/:poolAddress/instruments/:instrumentId/mature')
  async matureInstrument(
    @Param('poolAddress') poolAddress: string,
    @Param('instrumentId') instrumentId: string,
  ) {
    return this.spvService.matureInstrument({ poolAddress, instrumentId });
  }

  @Get('pools/:poolAddress/instruments')
  async getPoolInstruments(@Param('poolAddress') poolAddress: string) {
    return this.spvService.getPoolInstruments(poolAddress);
  }

  @Get('operations')
  async getOperations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.spvService.getOperations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get('analytics/overview')
  async getAnalyticsOverview() {
    return this.spvService.getAnalyticsOverview();
  }

  @Get('analytics/maturities')
  async getMaturities(@Query('days') days?: string) {
    return this.spvService.getMaturities(days ? parseInt(days, 10) : 90);
  }

  @Get('pools')
  async getPools(@Query('includeInactive') includeInactive?: string) {
    return this.spvService.getPools(includeInactive === 'true');
  }

  @Get('pools/:poolAddress')
  async getPoolById(@Param('poolAddress') poolAddress: string) {
    return this.spvService.getPoolById(poolAddress);
  }
}

