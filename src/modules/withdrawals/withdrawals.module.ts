import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [WithdrawalsService, PrismaService],
  controllers: [WithdrawalsController],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
