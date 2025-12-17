import { IsString, IsNotEmpty } from 'class-validator';

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

export class RebalancePoolReservesDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;

  @IsNotEmpty()
  action: 0 | 1; // 0 = liquidate, 1 = invest

  @IsString()
  @IsNotEmpty()
  amount: string;
}

