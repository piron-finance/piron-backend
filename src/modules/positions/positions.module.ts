import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsController } from './positions.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [PositionsService, PrismaService],
  controllers: [PositionsController],
  exports: [PositionsService],
})
export class PositionsModule {}
