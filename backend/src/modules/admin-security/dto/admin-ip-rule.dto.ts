import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminIpRuleType } from './admin-query-security.dto';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminCreateIpRuleDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(80)
  ipAddress!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  cidr?: string;

  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['ALLOW', 'BLOCK', 'WATCH'])
  type!: AdminIpRuleType;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateIpRuleDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  cidr?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ALLOW', 'BLOCK', 'WATCH'])
  type?: AdminIpRuleType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  clearExpiresAt?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
