import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import {
  CreateWithdrawalDto,
  RedeemLockedPositionDto,
  EarlyExitDto,
  SetAutoRolloverDto,
  TransferPositionDto,
} from './dtos/withdrawal.dto';

@Controller('withdrawals')
export class WithdrawalsController {
  private readonly logger = new Logger(WithdrawalsController.name);

  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  /**
   * Build withdrawal transaction for Single-Asset or Stable Yield pools
   */
  @Post()
  async buildWithdrawal(@Body() dto: CreateWithdrawalDto) {
    this.logger.log(`POST /withdrawals called with: ${JSON.stringify(dto)}`);
    const result = await this.withdrawalsService.buildWithdrawalTransaction(dto);
    this.logger.log(`Withdrawal transaction built successfully`);
    return result;
  }

  /**
   * Build redemption transaction for matured locked positions
   */
  @Post('redeem')
  async buildRedeem(@Body() dto: RedeemLockedPositionDto) {
    this.logger.log(`POST /withdrawals/redeem for position ${dto.positionId}`);
    const result = await this.withdrawalsService.buildRedeemTransaction(dto);
    this.logger.log(`Redeem transaction built successfully`);
    return result;
  }

  /**
   * Build early exit transaction for active locked positions
   */
  @Post('early-exit')
  async buildEarlyExit(@Body() dto: EarlyExitDto) {
    this.logger.log(`POST /withdrawals/early-exit for position ${dto.positionId}`);
    const result = await this.withdrawalsService.buildEarlyExitTransaction(dto);
    this.logger.log(`Early exit transaction built successfully`);
    return result;
  }

  /**
   * Build transaction to set/toggle auto-rollover for locked position
   */
  @Post('auto-rollover')
  async buildSetAutoRollover(@Body() dto: SetAutoRolloverDto) {
    this.logger.log(
      `POST /withdrawals/auto-rollover for position ${dto.positionId}`,
    );
    const result =
      await this.withdrawalsService.buildSetAutoRolloverTransaction(dto);
    this.logger.log(`Auto-rollover transaction built successfully`);
    return result;
  }

  /**
   * Build transaction to transfer locked position to another address
   */
  @Post('transfer-position')
  async buildTransferPosition(@Body() dto: TransferPositionDto) {
    this.logger.log(
      `POST /withdrawals/transfer-position for position ${dto.positionId}`,
    );
    const result =
      await this.withdrawalsService.buildTransferPositionTransaction(dto);
    this.logger.log(`Transfer position transaction built successfully`);
    return result;
  }

  /**
   * Get withdrawal queue status for Stable Yield pools
   */
  @Get('queue-status')
  async getQueueStatus(
    @Query('poolAddress') poolAddress: string,
    @Query('userAddress') userAddress: string,
  ) {
    this.logger.log(
      `GET /withdrawals/queue-status for ${userAddress} in ${poolAddress}`,
    );
    return this.withdrawalsService.getWithdrawalQueueStatus(
      poolAddress,
      userAddress,
    );
  }

  /**
   * Preview withdrawal amounts and fees
   */
  @Get('preview')
  async previewWithdrawal(
    @Query('poolAddress') poolAddress: string,
    @Query('amount') amount: string,
    @Query('userAddress') userAddress: string,
  ) {
    this.logger.log(
      `GET /withdrawals/preview for ${amount} from ${poolAddress}`,
    );
    return this.withdrawalsService.previewWithdrawal(
      poolAddress,
      amount,
      userAddress,
    );
  }
}
