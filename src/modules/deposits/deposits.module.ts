import { Module } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [DepositsService, PrismaService],
  controllers: [DepositsController],
  exports: [DepositsService],
})
export class DepositsModule {}

