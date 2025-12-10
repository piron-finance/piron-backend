import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  decimals: number;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsBoolean()
  @IsOptional()
  isStablecoin?: boolean;

  @IsString()
  @IsOptional()
  riskRating?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}

export class UpdateAssetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  riskRating?: string;

  @IsBoolean()
  @IsOptional()
  isApproved?: boolean;

  @IsBoolean()
  @IsOptional()
  isStablecoin?: boolean;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}

export class AssetQueryDto {
  @IsString()
  @IsOptional()
  status?: 'active' | 'pending' | 'revoked';

  @IsString()
  @IsOptional()
  region?: string;
}

