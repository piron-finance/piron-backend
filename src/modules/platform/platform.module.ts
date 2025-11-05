import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [PlatformService, PrismaService],
  controllers: [PlatformController],
  exports: [PlatformService],
})
export class PlatformModule {}
