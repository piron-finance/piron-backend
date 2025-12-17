import { IsString, IsNotEmpty } from 'class-validator';

export class GetPoolDetailDto {
  @IsString()
  @IsNotEmpty()
  poolAddress: string;
}

