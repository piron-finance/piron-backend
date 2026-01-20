import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PositionsService } from './positions.service';

@Controller('users')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /**
   * Get all positions for a user (both regular and locked)
   */
  @Get(':walletAddress/positions')
  async getUserPositions(@Param('walletAddress') walletAddress: string) {
    return this.positionsService.getUserPositions(walletAddress);
  }

  /**
   * Get user's position in a specific pool (Single-Asset or Stable Yield)
   */
  @Get(':walletAddress/positions/:poolAddress')
  async getUserPositionInPool(
    @Param('walletAddress') walletAddress: string,
    @Param('poolAddress') poolAddress: string,
  ) {
    return this.positionsService.getUserPositionInPool(walletAddress, poolAddress);
  }

  /**
   * Get all locked positions for a user
   */
  @Get(':walletAddress/locked-positions')
  async getUserLockedPositions(@Param('walletAddress') walletAddress: string) {
    return this.positionsService.getUserLockedPositions(walletAddress);
  }
}

/**
 * Separate controller for locked position operations
 */
@Controller('locked-positions')
export class LockedPositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  /**
   * Get a specific locked position by global ID
   */
  @Get(':positionId')
  async getLockedPosition(@Param('positionId', ParseIntPipe) positionId: number) {
    return this.positionsService.getLockedPosition(positionId);
  }

  /**
   * Preview early exit calculation for a locked position
   */
  @Get(':positionId/preview-early-exit')
  async previewEarlyExit(@Param('positionId', ParseIntPipe) positionId: number) {
    return this.positionsService.previewEarlyExit(positionId);
  }
}
