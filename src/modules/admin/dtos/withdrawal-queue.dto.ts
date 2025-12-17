import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsEnum } from 'class-validator';

export class ProcessWithdrawalQueueDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsInt()
  @Min(1)
  maxRequests: number;
}

export enum WithdrawalQueueStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class WithdrawalQueueQueryDto {
  @IsString()
  @IsOptional()
  poolId?: string;

  @IsEnum(WithdrawalQueueStatus)
  @IsOptional()
  status?: WithdrawalQueueStatus;
}

