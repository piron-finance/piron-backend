import { Module } from '@nestjs/common';
import { YieldReserveService } from './yield-reserve.service';
import { YieldReserveController } from './yield-reserve.controller';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [YieldReserveService, PrismaService],
  controllers: [YieldReserveController],
  exports: [YieldReserveService],
})
export class YieldReserveModule {}
