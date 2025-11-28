import { Module } from '@nestjs/common';
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
