import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SubgraphWebhookController } from './subgraph-webhook.controller';
import { SubgraphWebhookService } from './subgraph-webhook.service';
import {
  EventProcessorService,
  ImmediateEventProcessor,
  DelayedEventProcessor,
} from './event-processor.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    // Priority queues for event processing
    BullModule.registerQueue(
      {
        name: 'immediate-events', // Deposits, Withdrawals
      },
      {
        name: 'delayed-events', // Analytics, NAV updates
      },
    ),
  ],
  controllers: [SubgraphWebhookController],
  providers: [
    SubgraphWebhookService,
    EventProcessorService,
    ImmediateEventProcessor,
    DelayedEventProcessor,
    PrismaService,
  ],
  exports: [SubgraphWebhookService],
})
export class SubgraphWebhookModule {}

