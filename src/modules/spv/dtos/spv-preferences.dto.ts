import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class SetInvestmentThresholdDto {
  @IsString()
  @IsOptional()
  poolAddress?: string; // null = applies to all pools

  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  minimumAmount: string; // Minimum amount to notify

  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  pushNotifications?: boolean;
}

export class GetAlertsQueryDto {
  @IsString()
  @IsOptional()
  poolAddress?: string; // Filter by specific pool
}

