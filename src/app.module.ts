import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaService } from './prisma.service';
import { UsersModule } from './modules/users/users.module';
import { PoolsModule } from './modules/pools/pools.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PositionsModule } from './modules/positions/positions.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AdminModule } from './modules/admin/admin.module';
import { SpvModule } from './modules/spv/spv.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 1000, // Keep last 1000 failed jobs
      },
    }),
    BlockchainModule,
    UsersModule,
    PoolsModule,
    PlatformModule,
    PositionsModule,
    TransactionsModule,
    AdminModule,
    SpvModule,
    DepositsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
