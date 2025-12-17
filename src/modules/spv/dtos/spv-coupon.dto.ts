import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class RecordCouponDto {
  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsDateString()
  paymentDate: Date;

  @IsString()
  @IsNotEmpty()
  proofHash: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export enum CouponScheduleRange {
  NEXT_30_DAYS = 'next30days',
  NEXT_90_DAYS = 'next90days',
  ALL = 'all',
}

export enum CouponStatus {
  DUE = 'due',
  RECEIVED = 'received',
  OVERDUE = 'overdue',
}

export class CouponScheduleQueryDto {
  @IsString()
  @IsOptional()
  poolId?: string;

  @IsEnum(CouponScheduleRange)
  @IsOptional()
  range?: CouponScheduleRange;

  @IsEnum(CouponStatus)
  @IsOptional()
  status?: CouponStatus;
}

