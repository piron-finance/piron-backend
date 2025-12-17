import { IsString, IsNotEmpty } from 'class-validator';

export class ReceiveSPVMaturityDto {
  @IsString()
  @IsNotEmpty()
  amount: string;
}

