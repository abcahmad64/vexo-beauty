import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AI_INCIDENT_EVENT_TYPES,
  AI_INCIDENT_SEVERITIES,
  type AiIncidentEventType,
  type AiIncidentSeverity,
} from '../interfaces/ai-incident-timeline.interface';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class QueryAiIncidentTimelinesDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) source?: string;
  @IsOptional() @IsIn(AI_INCIDENT_SEVERITIES) severity?: AiIncidentSeverity;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
export class AdminOpenAiIncidentDto {
  @IsOptional() @IsUUID() incidentId?: string;
  @IsIn(AI_INCIDENT_SEVERITIES) severity!: AiIncidentSeverity;
  @Transform(trim) @IsString() @MaxLength(120) source!: string;
  @Transform(trim) @IsString() @MaxLength(220) title!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsISO8601() occurredAt?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) requestId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) traceId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) runId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) jobId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) runbookIds?: string[];
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
export class AdminAppendAiIncidentEventDto {
  @IsIn(AI_INCIDENT_EVENT_TYPES) eventType!: AiIncidentEventType;
  @IsOptional() @IsIn(AI_INCIDENT_SEVERITIES) severity?: AiIncidentSeverity;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(220) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsISO8601() occurredAt?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) requestId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) traceId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) runId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(240) jobId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) runbookIds?: string[];
  @IsOptional() @IsObject() evidence?: Record<string, unknown>;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
