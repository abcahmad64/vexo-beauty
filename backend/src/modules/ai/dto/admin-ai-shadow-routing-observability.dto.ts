import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class QueryAiShadowRoutingDecisionsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  decisionId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  taskType?: string;

  @IsOptional()
  @Transform(trim)
  @IsIn(['BASELINE', 'CANDIDATE', 'NO_ROLLOUT'])
  cohort?: 'BASELINE' | 'CANDIDATE' | 'NO_ROLLOUT';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  rolloutId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  userId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  requestId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  traceId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  executionId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  aiRunLogId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}

export class CleanupAiShadowRoutingDecisionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays: number = 30;
}
