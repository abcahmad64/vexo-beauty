import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ResolveAiShadowModelRoutingDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  task?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(240)
  subjectKey?: string;

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
}
