import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class GetRolePoolsDto {
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  needsAction?: boolean;
}

export class CreateRoleProposalDto {
  @IsString()
  @IsNotEmpty()
  proposalType: 'ROLE_GRANT' | 'ROLE_REVOKE' | 'FEE_CHANGE';

  @IsString()
  @IsNotEmpty()
  targetAddress: string;

  @IsString()
  @IsOptional()
  roleId?: string;

  @IsString()
  @IsOptional()
  executionData?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

