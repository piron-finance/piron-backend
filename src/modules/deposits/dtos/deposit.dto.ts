import { IsString, IsNotEmpty } from 'class-validator';

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
