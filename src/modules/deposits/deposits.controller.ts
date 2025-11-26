import { Controller, Post, Body, Logger } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dtos/deposit.dto';

@Controller('deposits')
export class DepositsController {
  private readonly logger = new Logger(DepositsController.name);

  constructor(private readonly depositsService: DepositsService) {}

  @Post()
  async buildDeposit(@Body() dto: CreateDepositDto) {
    this.logger.log(`POST /deposits called with: ${JSON.stringify(dto)}`);
    const result = await this.depositsService.buildDepositTransaction(dto);
    this.logger.log(`Deposit transaction built successfully`);
    return result;
  }
}
