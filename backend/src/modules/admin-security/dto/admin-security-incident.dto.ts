import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminSecurityIncidentStatus,
  AdminSecuritySeverity,
  AdminSecuritySource,
  AdminSecurityTargetType,
} from './admin-query-security.dto';

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

export class AdminCreateSecurityIncidentDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminSecuritySeverity;

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
  targetId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  assignedAdminId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AdminUpdateSecurityIncidentDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminSecuritySeverity;

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
  targetId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userAgent?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AdminUpdateSecurityIncidentStatusDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'])
  status!: AdminSecurityIncidentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}

export class AdminAssignSecurityIncidentDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  adminId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
