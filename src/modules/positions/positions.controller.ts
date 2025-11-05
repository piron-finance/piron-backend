import { Controller, Get, Param } from '@nestjs/common';
import { PositionsService } from './positions.service';

@Controller('users')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get(':walletAddress/positions')
  async getUserPositions(@Param('walletAddress') walletAddress: string) {
    return this.positionsService.getUserPositions(walletAddress);
  }

  @Get(':walletAddress/positions/:poolAddress')
  async getUserPositionInPool(
    @Param('walletAddress') walletAddress: string,
    @Param('poolAddress') poolAddress: string,
  ) {
    return this.positionsService.getUserPositionInPool(walletAddress, poolAddress);
  }
}
