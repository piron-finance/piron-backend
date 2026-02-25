import { Controller, Post, Body, Get, Param, Logger } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { CreateDepositDto, CreateLockedDepositDto } from './dtos/deposit.dto';

@Controller('deposits')
export class DepositsController {
  private readonly logger = new Logger(DepositsController.name);

  constructor(private readonly depositsService: DepositsService) {}

  /**
   * Build deposit transaction for Single-Asset or Stable Yield pools
   */
  @Post()
  async buildDeposit(@Body() dto: CreateDepositDto) {
    this.logger.log(`POST /deposits called with: ${JSON.stringify(dto)}`);
    const result = await this.depositsService.buildDepositTransaction(dto);
    this.logger.log(`Deposit transaction built successfully`);
    return result;
  }

  /**
   * Build locked deposit transaction with tier and interest payment selection
   */
  @Post('locked')
  async buildLockedDeposit(@Body() dto: CreateLockedDepositDto) {
    this.logger.log(`POST /deposits/locked called with: ${JSON.stringify(dto)}`);
    const result = await this.depositsService.buildLockedDepositTransaction(dto);
    this.logger.log(`Locked deposit transaction built successfully`);
    return result;
  }

  /**
   * Get available lock tiers for a pool
   */
  @Get('tiers/:poolAddress')
  async getPoolTiers(@Param('poolAddress') poolAddress: string) {
    this.logger.log(`GET /deposits/tiers/${poolAddress}`);
    return this.depositsService.getPoolLockTiers(poolAddress);
  }
}
