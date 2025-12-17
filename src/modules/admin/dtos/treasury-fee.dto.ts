import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';

export class WithdrawTreasuryDto {
  @IsString()
  @IsNotEmpty()
  asset: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CollectFeesDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;
}

export enum FeeType {
  MANAGEMENT = 'MANAGEMENT',
  PERFORMANCE = 'PERFORMANCE',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum PoolTypeEnum {
  SINGLE_ASSET = 'SINGLE_ASSET',
  STABLE_YIELD = 'STABLE_YIELD',
}

export class UpdateFeeConfigDto {
  @IsEnum(PoolTypeEnum)
  poolType: PoolTypeEnum;

  @IsEnum(FeeType)
  feeType: FeeType;

  @IsNumber()
  @Min(0)
  rate: number; // basis points
}

export class EmergencyActionDto {
  @IsEnum(['PAUSE', 'UNPAUSE', 'FORCE_CLOSE_EPOCH'])
  action: 'PAUSE' | 'UNPAUSE' | 'FORCE_CLOSE_EPOCH';

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  poolAddress?: string; // For pool-specific actions
}

