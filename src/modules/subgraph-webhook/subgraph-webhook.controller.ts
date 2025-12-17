import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SubgraphWebhookService } from './subgraph-webhook.service';
import { WebhookEventDto, BatchWebhookDto } from './dtos/webhook-event.dto';
import * as crypto from 'crypto';

@Controller('webhooks/goldsky')
export class SubgraphWebhookController {
  private readonly logger = new Logger(SubgraphWebhookController.name);

  constructor(private readonly webhookService: SubgraphWebhookService) {}

  /**
   * Receive single event from Goldsky webhook
   */
  @Post('event')
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Body() event: WebhookEventDto,
    @Headers('x-goldsky-signature') signature: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received webhook event: ${event.event}`);

    // Verify signature
    if (!this.verifySignature(JSON.stringify(event), signature)) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    try {
      await this.webhookService.processEvent(event);
      return { success: true, message: 'Event queued for processing' };
    } catch (error) {
      this.logger.error(`Error processing webhook event: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Receive batch of events from Goldsky webhook
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async handleBatch(
    @Body() batch: BatchWebhookDto,
    @Headers('x-goldsky-signature') signature: string,
  ): Promise<{ success: boolean; processed: number; failed: number }> {
    this.logger.log(`Received batch of ${batch.events.length} events`);

    // Verify signature
    if (!this.verifySignature(JSON.stringify(batch), signature)) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid signature');
    }

    let processed = 0;
    let failed = 0;

    for (const event of batch.events) {
      try {
        await this.webhookService.processEvent(event);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process event ${event.event}: ${error.message}`);
        failed++;
      }
    }

    return { success: true, processed, failed };
  }

  /**
   * Health check endpoint for Goldsky to verify webhook is alive
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  healthCheck(): { status: string; timestamp: number } {
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  }

  /**
   * Verify Goldsky webhook signature
   */
  private verifySignature(payload: string, signature: string): boolean {
    if (!signature) {
      this.logger.warn('No signature provided');
      return false;
    }

    const webhookSecret = process.env.GOLDSKY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('GOLDSKY_WEBHOOK_SECRET not configured, skipping verification');
      return true; // In dev, allow without signature
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return false;
    }
  }
}

