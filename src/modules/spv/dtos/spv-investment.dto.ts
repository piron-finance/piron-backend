import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class WithdrawFundsDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  spvAddress: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmInvestmentDto {
  @IsString()
  @IsNotEmpty()
  spvOperationId: string;

  @IsString()
  @IsNotEmpty()
  amountInvested: string;

  @IsString()
  @IsNotEmpty()
  proofHash: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

