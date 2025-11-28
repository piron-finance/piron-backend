import { IsString, IsNotEmpty, IsNumber, IsDateString, Min, Max, IsEnum, IsOptional } from 'class-validator';

export class AllocateToSPVDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  spvAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class AddInstrumentDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsEnum(['DISCOUNTED', 'INTEREST_BEARING'])
  @IsNotEmpty()
  instrumentType: 'DISCOUNTED' | 'INTEREST_BEARING';

  @IsString()
  @IsNotEmpty()
  purchasePrice: string;

  @IsString()
  @IsNotEmpty()
  faceValue: string;

  @IsDateString()
  @IsNotEmpty()
  maturityDate: string;

  @IsNumber()
  @Min(0)
  @Max(10000)
  @IsOptional()
  annualCouponRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  couponFrequency?: number;

  @IsString()
  @IsOptional()
  name?: string;
}

export class MatureInstrumentDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  instrumentId: string;
}

