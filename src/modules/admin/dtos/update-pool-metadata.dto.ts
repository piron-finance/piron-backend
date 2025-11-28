import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator';
import { KYCStatus } from '@prisma/client';

export class UpdatePoolMetadataDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  issuer?: string;

  @IsString()
  @IsOptional()
  issuerLogo?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  securityType?: string;

  @IsString()
  @IsOptional()
  cusip?: string;

  @IsString()
  @IsOptional()
  isin?: string;

  @IsString()
  @IsOptional()
  prospectusUrl?: string;

  @IsString()
  @IsOptional()
  riskRating?: string;

  @IsEnum(KYCStatus)
  @IsOptional()
  minimumKYCLevel?: KYCStatus;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
