import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Lock tier configuration for Locked Pools
 */
export class LockTierConfigDto {
  @IsNumber()
  @Min(1)
  durationDays: number; // 90, 180, 365

  @IsNumber()
  @Min(0)
  @Max(10000)
  apyBps: number; // 500 = 5%

  @IsNumber()
  @Min(0)
  @Max(10000)
  earlyExitPenaltyBps: number; // 1000 = 10%

  @IsString()
  @IsNotEmpty()
  minDeposit: string; // Minimum deposit amount

  @IsBoolean()
  @IsOptional()
  isActive?: boolean; // Default true
}

export class CreatePoolDto {
  @IsEnum(['SINGLE_ASSET', 'STABLE_YIELD', 'LOCKED'])
  @IsNotEmpty()
  poolType: 'SINGLE_ASSET' | 'STABLE_YIELD' | 'LOCKED';

  // On-chain parameters
  @IsString()
  @IsNotEmpty()
  asset: string; // Asset address (USDC, cNGN, etc.)

  @IsString()
  @IsNotEmpty()
  minInvestment: string; // Minimum investment amount (e.g., "100")

  // Single-Asset specific
  @IsString()
  @IsOptional()
  targetRaise?: string; // Target raise amount (e.g., "10000000")

  @IsDateString()
  @IsOptional()
  epochEndTime?: string; // When funding period ends (Single-Asset only)

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  withdrawalFeeBps?: number; //basis pts (single asset excls)

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  minimumFundingThreshold?: number; // BPS: 8000 = 80% of targetRaise required

  @IsArray()
  @IsOptional()
  couponDates?: number[]; // Unix timestamps for coupon payment dates

  @IsArray()
  @IsOptional()
  couponRates?: number[]; // Basis points for each coupon (e.g., 200 = 2%)

  @IsDateString()
  @IsOptional()
  maturityDate?: string; // When instrument matures (Single-Asset only)

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  discountRate?: number; // Basis points (e.g., 560 = 5.6%)

  @IsEnum(['DISCOUNTED', 'INTEREST_BEARING'])
  @IsOptional()
  instrumentType?: 'DISCOUNTED' | 'INTEREST_BEARING';

  // Locked Pool specific
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LockTierConfigDto)
  @ArrayMinSize(1, { message: 'At least one lock tier is required for Locked pools' })
  @IsOptional()
  initialTiers?: LockTierConfigDto[];

  // Off-chain metadata
  @IsString()
  @IsNotEmpty()
  name: string; // Pool name (e.g., "Nigerian 91-Day T-Bill")

  @IsString()
  @IsOptional()
  symbol?: string; // Pool token symbol (e.g., "lpNGN")

  @IsString()
  @IsOptional()
  description?: string; // Pool description

  @IsString()
  @IsOptional()
  issuer?: string; // Issuer name (e.g., "Central Bank of Nigeria")

  @IsString()
  @IsOptional()
  issuerLogo?: string; // URL to issuer logo

  @IsString()
  @IsOptional()
  country?: string; // Country (e.g., "Nigeria")

  @IsString()
  @IsOptional()
  region?: string; // Region (e.g., "Africa")

  @IsString()
  @IsOptional()
  riskRating?: string; // Risk rating (e.g., "AAA")

  @IsString()
  @IsOptional()
  securityType?: string; // Security type (e.g., "T-Bill", "Government Bond")

  @IsString()
  @IsNotEmpty()
  spvAddress: string; // SPV wallet address (required for all managed pools)

  @IsOptional()
  tags?: string[]; // Tags for filtering
}

export class ConfirmPoolDeploymentDto {
  @IsString()
  @IsNotEmpty()
  poolId: string;

  @IsString()
  @IsNotEmpty()
  txHash: string;
}

/**
 * Update lock tier configuration
 */
export class UpdateLockTierDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  apyBps?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000)
  earlyExitPenaltyBps?: number;

  @IsString()
  @IsOptional()
  minDeposit?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Add a new lock tier to an existing locked pool
 */
export class AddLockTierDto {
  @IsNumber()
  @Min(1)
  durationDays: number;

  @IsNumber()
  @Min(0)
  @Max(10000)
  apyBps: number;

  @IsNumber()
  @Min(0)
  @Max(10000)
  earlyExitPenaltyBps: number;

  @IsString()
  @IsNotEmpty()
  minDeposit: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
