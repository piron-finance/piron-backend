import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UsersModule } from './modules/users/users.module';
import { PoolsModule } from './modules/pools/pools.module';

@Module({
  imports: [UsersModule, PoolsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
