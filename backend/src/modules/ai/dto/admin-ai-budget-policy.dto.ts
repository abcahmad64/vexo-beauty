import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  AiBudgetScope,
  AiBudgetUnknownPricingMode,
  AiBudgetWindow,
} from '../interfaces/ai-budget-enforcement.interface';

const trimRequiredString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  return value;
};

export class QueryAiBudgetPoliciesDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['GLOBAL', 'USER', 'AGENT', 'PROVIDER', 'MODEL', 'TASK'])
  scope?: AiBudgetScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ROLLING_24_HOURS'])
  window?: AiBudgetWindow;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class AdminCreateAiBudgetPolicyDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['GLOBAL', 'USER', 'AGENT', 'PROVIDER', 'MODEL', 'TASK'])
  scope!: AiBudgetScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ROLLING_24_HOURS'])
  window!: AiBudgetWindow;

  @IsString()
  @Transform(trimRequiredString)
  @Matches(/^\d+$/u)
  softLimitMicros!: string;

  @IsString()
  @Transform(trimRequiredString)
  @Matches(/^\d+$/u)
  hardLimitMicros!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WARN', 'BLOCK'])
  unknownPricingMode?: AiBudgetUnknownPricingMode;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;
}

export class AdminUpdateAiBudgetPolicyDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['GLOBAL', 'USER', 'AGENT', 'PROVIDER', 'MODEL', 'TASK'])
  scope?: AiBudgetScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'ROLLING_24_HOURS'])
  window?: AiBudgetWindow;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+$/u)
  softLimitMicros?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+$/u)
  hardLimitMicros?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WARN', 'BLOCK'])
  unknownPricingMode?: AiBudgetUnknownPricingMode;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;
}
