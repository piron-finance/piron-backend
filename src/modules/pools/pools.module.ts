import { Module } from '@nestjs/common';
import { PoolsController } from './pools.controller';
import { PoolsService } from './pools.service';
import { PrismaService } from '../../prisma.service';
import { BlockchainModule } from '../../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  controllers: [PoolsController],
  providers: [PoolsService, PrismaService],
  exports: [PoolsService],
})
export class PoolsModule {}
