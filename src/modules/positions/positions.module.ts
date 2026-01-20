import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController, LockedPositionsController } from './positions.controller';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [PositionsService, PrismaService],
  controllers: [PositionsController, LockedPositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}
