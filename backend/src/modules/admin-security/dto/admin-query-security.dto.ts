import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export type AdminSecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AdminSecurityIncidentStatus =
  'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export type AdminSecuritySource =
  'AUTH' | 'RBAC' | 'API' | 'ADMIN' | 'ORDER' | 'PAYMENT' | 'SYSTEM' | 'AI';

export type AdminSecurityTargetType =
  | 'USER'
  | 'ADMIN'
  | 'SESSION'
  | 'IP'
  | 'API_KEY'
  | 'ORDER'
  | 'PAYMENT'
  | 'SYSTEM';

export type AdminSecurityPolicyCategory =
  | 'AUTH'
  | 'SESSION'
  | 'RBAC'
  | 'API'
  | 'DATA'
  | 'PRIVACY'
  | 'PAYMENT'
  | 'SYSTEM';

export type AdminIpRuleType = 'ALLOW' | 'BLOCK' | 'WATCH';

export type AdminSecurityDecision = 'ALLOW' | 'WATCH' | 'BLOCK';

export class AdminQuerySecurityDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  entityId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  key?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  assignedAdminId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminSecuritySeverity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'])
  status?: AdminSecurityIncidentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['AUTH', 'RBAC', 'API', 'ADMIN', 'ORDER', 'PAYMENT', 'SYSTEM', 'AI'])
  source?: AdminSecuritySource;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'USER',
    'ADMIN',
    'SESSION',
    'IP',
    'API_KEY',
    'ORDER',
    'PAYMENT',
    'SYSTEM',
  ])
  targetType?: AdminSecurityTargetType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'AUTH',
    'SESSION',
    'RBAC',
    'API',
    'DATA',
    'PRIVACY',
    'PAYMENT',
    'SYSTEM',
  ])
  category?: AdminSecurityPolicyCategory;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ALLOW', 'BLOCK', 'WATCH'])
  ipRuleType?: AdminIpRuleType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ALLOW', 'WATCH', 'BLOCK'])
  decision?: AdminSecurityDecision;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
