import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UsersModule } from './modules/users/users.module';
import { PoolsModule } from './modules/pools/pools.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PositionsModule } from './modules/positions/positions.module';

@Module({
  imports: [UsersModule, PoolsModule, PlatformModule, PositionsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
