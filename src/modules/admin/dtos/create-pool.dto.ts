import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';

export class CreatePoolDto {
  @IsEnum(['SINGLE_ASSET', 'STABLE_YIELD'])
  @IsNotEmpty()
  poolType: 'SINGLE_ASSET' | 'STABLE_YIELD';

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

  // Off-chain metadata
  @IsString()
  @IsNotEmpty()
  name: string; // Pool name (e.g., "Nigerian 91-Day T-Bill")

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
  @IsOptional()
  spvAddress?: string; // SPV wallet address (for Stable Yield pools)

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
