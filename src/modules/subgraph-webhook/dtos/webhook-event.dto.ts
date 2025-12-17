import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class WebhookEventDto {
  @IsString()
  event: string; // Event name: "Deposit", "Withdraw", etc.

  @IsObject()
  data: any; // Event data payload

  @IsString()
  @IsOptional()
  signature?: string; // Goldsky signature for verification

  @IsNumber()
  @IsOptional()
  timestamp?: number;

  @IsString()
  @IsOptional()
  subgraphId?: string;
}

export class BatchWebhookDto {
  events: WebhookEventDto[];
}

