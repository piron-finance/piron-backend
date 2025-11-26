import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

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

