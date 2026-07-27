import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AI_SLO_SCOPES,
  AI_SLO_WINDOWS,
  type AiSloScope,
  type AiSloWindow,
} from '../interfaces/ai-slo-error-budget.interface';

const trimRequiredString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return value;
};

export class QueryAiSloPoliciesDto {
  @IsOptional()
  @IsIn(AI_SLO_SCOPES)
  scope?: AiSloScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @IsIn(AI_SLO_WINDOWS)
  window?: AiSloWindow;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class QueryAiSloReportDto extends QueryAiSloPoliciesDto {
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}

export class AdminCreateAiSloPolicyDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsIn(AI_SLO_SCOPES)
  scope!: AiSloScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsIn(AI_SLO_WINDOWS)
  window!: AiSloWindow;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @Min(0.00001)
  @Max(100)
  availabilityTargetPercent!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3_600_000)
  latencyTargetMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  minimumSampleSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  warningBurnRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  criticalBurnRate?: number;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;
}

export class AdminUpdateAiSloPolicyDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsIn(AI_SLO_SCOPES)
  scope?: AiSloScope;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @IsIn(AI_SLO_WINDOWS)
  window?: AiSloWindow;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 5 })
  @Min(0.00001)
  @Max(100)
  availabilityTargetPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3_600_000)
  latencyTargetMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  minimumSampleSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  warningBurnRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(1000)
  criticalBurnRate?: number;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  priority?: number;
}
