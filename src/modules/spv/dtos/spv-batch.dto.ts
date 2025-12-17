import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class MaturityItem {
  @IsString()
  @IsNotEmpty()
  instrumentId: string;

  @IsString()
  @IsNotEmpty()
  returnAmount: string;

  @IsString()
  @IsOptional()
  proofHash?: string;
}

export class BatchMatureDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaturityItem)
  @ArrayMaxSize(50)
  maturities: MaturityItem[];
}

