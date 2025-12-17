import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WebhookEventDto } from './dtos/webhook-event.dto';

/**
 * Priority events that need immediate processing
 */
const IMMEDIATE_EVENTS = [
  'Deposit',
  'Withdraw',
  'PoolCreated',
  'StableYieldPoolCreated',
  'CouponClaimed',
  'WithdrawalProcessed',
  'EmergencyWithdrawal',
  'PoolCancelled',
  'EmergencyStateChanged',
];

/**
 * Events that can be delayed (analytics, snapshots)
 */
const DELAYED_EVENTS = [
  'NAVUpdated',
  'InstrumentPurchased',
  'InstrumentMatured',
  'ReservesRebalanced',
  'CouponPaymentReceived',
  'CouponDistributed',
];

@Injectable()
export class SubgraphWebhookService {
  private readonly logger = new Logger(SubgraphWebhookService.name);

  constructor(
    @InjectQueue('immediate-events') private immediateQueue: Queue,
    @InjectQueue('delayed-events') private delayedQueue: Queue,
  ) {}

  /**
   * Process incoming webhook event - route to appropriate queue
   */
  async processEvent(event: WebhookEventDto): Promise<void> {
    const eventName = event.event;

    if (IMMEDIATE_EVENTS.includes(eventName)) {
      // Add to immediate queue (highest priority)
      await this.immediateQueue.add(
        'process-immediate',
        event,
        {
          priority: 1,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`Queued immediate event: ${eventName}`);
    } else if (DELAYED_EVENTS.includes(eventName)) {
      // Add to delayed queue (lower priority, 2 minute delay)
      await this.delayedQueue.add(
        'process-delayed',
        event,
        {
          priority: 10,
          delay: 120000, // 2 minutes
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`Queued delayed event: ${eventName} (will process in 2 mins)`);
    } else {
      // Unknown event - queue as delayed with low priority
      this.logger.warn(`Unknown event type: ${eventName}, queuing as delayed`);
      await this.delayedQueue.add('process-delayed', event, {
        priority: 20,
        attempts: 2,
      });
    }
  }

  /**
   * Get queue stats for monitoring
   */
  async getQueueStats(): Promise<{
    immediate: any;
    delayed: any;
  }> {
    const [immediateWaiting, immediateActive, immediateFailed] = await Promise.all([
      this.immediateQueue.getWaitingCount(),
      this.immediateQueue.getActiveCount(),
      this.immediateQueue.getFailedCount(),
    ]);

    const [delayedWaiting, delayedActive, delayedFailed] = await Promise.all([
      this.delayedQueue.getWaitingCount(),
      this.delayedQueue.getActiveCount(),
      this.delayedQueue.getFailedCount(),
    ]);

    return {
      immediate: {
        waiting: immediateWaiting,
        active: immediateActive,
        failed: immediateFailed,
      },
      delayed: {
        waiting: delayedWaiting,
        active: delayedActive,
        failed: delayedFailed,
      },
    };
  }
}

