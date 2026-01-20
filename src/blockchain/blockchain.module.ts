import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { PoolBuilderService } from './pool-builder.service';
import { PoolCreationWatcher } from './pool-creation-watcher.service';
import { DepositIndexer } from './deposit-indexer.service';
import { LockedPositionIndexer } from './locked-position-indexer.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [
    BlockchainService,
    PoolBuilderService,
    PoolCreationWatcher,
    DepositIndexer,
    LockedPositionIndexer,
    PrismaService,
  ],
  exports: [
    BlockchainService,
    PoolBuilderService,
    PoolCreationWatcher,
    DepositIndexer,
    LockedPositionIndexer,
  ],
})
export class BlockchainModule {}
