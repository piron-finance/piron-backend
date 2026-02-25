import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateWithdrawalDto {
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

export class RedeemLockedPositionDto {
  @IsNumber()
  @Min(0)
  positionId: number;

  @IsString()
  @IsNotEmpty()
  poolAddress: string;
}

export class EarlyExitDto {
  @IsNumber()
  @Min(0)
  positionId: number;

  @IsString()
  @IsNotEmpty()
  poolAddress: string;
}

export class SetAutoRolloverDto {
  @IsNumber()
  @Min(0)
  positionId: number;

  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newTierIndex?: number;
}

export class TransferPositionDto {
  @IsNumber()
  @Min(0)
  positionId: number;

  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsString()
  @IsNotEmpty()
  toAddress: string;
}
