import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminAiTaskType } from './admin-query-ai.dto';

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

export class AdminRunAiTaskDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn([
    'STORE_HEALTH_SUMMARY',
    'SALES_INSIGHT',
    'SEO_REVIEW',
    'SUPPORT_SUMMARY',
    'SEARCH_INSIGHT',
    'CUSTOM_PROMPT',
  ])
  taskType!: AdminAiTaskType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  promptTemplateId?: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
