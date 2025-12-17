import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum InstrumentStatusFilter {
  ACTIVE = 'active',
  MATURED = 'matured',
  ALL = 'all',
}

export enum InstrumentTypeFilter {
  DISCOUNTED = 'DISCOUNTED',
  INTEREST_BEARING = 'INTEREST_BEARING',
}

export enum MaturityRangeFilter {
  NEXT_30_DAYS = 'next30days',
  NEXT_90_DAYS = 'next90days',
  ALL = 'all',
}

export enum InstrumentSortBy {
  MATURITY_DATE = 'maturityDate',
  FACE_VALUE = 'faceValue',
  CREATED_AT = 'createdAt',
}

export class InstrumentsQueryDto {
  @IsEnum(InstrumentStatusFilter)
  @IsOptional()
  status?: InstrumentStatusFilter;

  @IsString()
  @IsOptional()
  poolId?: string;

  @IsEnum(InstrumentTypeFilter)
  @IsOptional()
  type?: InstrumentTypeFilter;

  @IsEnum(MaturityRangeFilter)
  @IsOptional()
  maturityRange?: MaturityRangeFilter;

  @IsEnum(InstrumentSortBy)
  @IsOptional()
  sortBy?: InstrumentSortBy;
}

