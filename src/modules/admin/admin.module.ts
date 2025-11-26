import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PoolCreationValidator } from './validators/pool-creation.validator';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [BlockchainModule],
  controllers: [AdminController],
  providers: [AdminService, PoolCreationValidator, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}

