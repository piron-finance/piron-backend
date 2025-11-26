import { Module } from '@nestjs/common';
import { SpvService } from './spv.service';
import { SpvController } from './spv.controller';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [SpvService, PrismaService],
  controllers: [SpvController],
  exports: [SpvService],
})
export class SpvModule {}

