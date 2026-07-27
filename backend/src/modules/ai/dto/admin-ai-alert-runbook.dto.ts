import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AI_ALERT_DECISIONS,
  AI_ALERT_SEVERITIES,
  AI_ALERT_SOURCES,
  type AiAlertDecision,
  type AiAlertSeverity,
  type AiAlertSource,
} from '../interfaces/ai-alert-runbook.interface';

const trimOptional = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return value;
};

export class QueryAiAlertRunbooksDto {
  @IsOptional()
  @IsIn(AI_ALERT_SOURCES)
  source?: AiAlertSource;

  @IsOptional()
  @IsIn(AI_ALERT_DECISIONS)
  decision?: AiAlertDecision;

  @IsOptional()
  @IsIn(AI_ALERT_SEVERITIES)
  severity?: AiAlertSeverity;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(120)
  scope?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class ResolveAiAlertRunbooksDto {
  @IsIn(AI_ALERT_SOURCES)
  source!: AiAlertSource;

  @IsString()
  @Transform(trimOptional)
  @MaxLength(80)
  decision!: string;

  @IsIn(AI_ALERT_SEVERITIES)
  severity!: AiAlertSeverity;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(120)
  scope?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(240)
  scopeValue?: string;

  @IsOptional()
  @IsISO8601()
  asOf?: string;
}

export class AdminCreateAiAlertRunbookDto {
  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  name!: string;

  @IsIn(AI_ALERT_SOURCES)
  source!: AiAlertSource;

  @IsIn(AI_ALERT_DECISIONS)
  decision!: AiAlertDecision;

  @IsIn(AI_ALERT_SEVERITIES)
  severity!: AiAlertSeverity;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(120)
  scope?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(240)
  scopeValue?: string;

  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  title!: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;

  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  owner!: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(1200)
  summary?: string;

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

export class AdminUpdateAiAlertRunbookDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsIn(AI_ALERT_SOURCES)
  source?: AiAlertSource;

  @IsOptional()
  @IsIn(AI_ALERT_DECISIONS)
  decision?: AiAlertDecision;

  @IsOptional()
  @IsIn(AI_ALERT_SEVERITIES)
  severity?: AiAlertSeverity;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(120)
  scope?: string | null;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(240)
  scopeValue?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptional)
  @MaxLength(180)
  owner?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(1200)
  summary?: string | null;

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
