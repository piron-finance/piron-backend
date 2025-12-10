import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, Min, IsInt } from 'class-validator';

export class PausePoolDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ApproveAssetDto {
  @IsString()
  @IsNotEmpty()
  assetAddress: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsNumber()
  @Min(0)
  decimals: number;

  @IsString()
  @IsOptional()
  riskRating?: string;
}

export class ProcessMaturityDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;
}

// ===== NEW POOL OPERATIONS =====

export class CloseEpochDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CancelPoolDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DistributeCouponDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsNumber()
  @Min(0)
  couponId: number;

  @IsString()
  @IsNotEmpty()
  amount: string;
}

