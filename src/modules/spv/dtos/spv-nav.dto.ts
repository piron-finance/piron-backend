import { IsString, IsNotEmpty } from 'class-validator';

export class TriggerNAVUpdateDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

