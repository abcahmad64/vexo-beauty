import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class QueryAiModelRolloutsDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) taskType?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  candidateModel?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeDeleted?: boolean;
}

export class AdminCreateAiModelRolloutDto {
  @Transform(trim) @IsString() @MaxLength(160) name!: string;
  @Transform(trim) @IsString() @MaxLength(120) baselineProvider!: string;
  @Transform(trim) @IsString() @MaxLength(240) baselineModel!: string;
  @Transform(trim) @IsString() @MaxLength(120) candidateProvider!: string;
  @Transform(trim) @IsString() @MaxLength(240) candidateModel!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) taskType?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) trafficPercent!: number;
  @Transform(trim) @IsString() @MaxLength(160) cohortSalt!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) minimumSampleSize!: number;
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxFailureRateIncreasePercent!: number;
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxP95LatencyIncreasePercent!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxCostIncreasePercent?: number;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;
}

export class AdminUpdateAiModelRolloutDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) name?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficPercent?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  minimumSampleSize?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxFailureRateIncreasePercent?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxP95LatencyIncreasePercent?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxCostIncreasePercent?: number;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;
}

export class QueryAiModelRolloutReportDto {
  @IsOptional() @IsISO8601() createdFrom?: string;
  @IsOptional() @IsISO8601() createdTo?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  limit?: number;
}

export class ResolveAiModelRolloutCohortDto {
  @Transform(trim) @IsString() @MaxLength(240) subjectKey!: string;
}
