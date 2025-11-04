import { IsOptional, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PoolType, PoolStatus } from '@prisma/client';

export class PoolQueryDto {
  @IsOptional()
  @IsEnum(PoolType)
  type?: PoolType;

  @IsOptional()
  @IsEnum(PoolStatus)
  status?: PoolStatus;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  country?: string;

  @IsOptional()
  region?: string;
}
