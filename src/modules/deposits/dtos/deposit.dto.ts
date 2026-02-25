import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateDepositDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  receiver: string;
}

export class CreateLockedDepositDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  depositor: string;

  @IsNumber()
  @Min(0)
  tierIndex: number;

  @IsOptional()
  @IsIn(['UPFRONT', 'AT_MATURITY'])
  interestPayment?: 'UPFRONT' | 'AT_MATURITY';
}
