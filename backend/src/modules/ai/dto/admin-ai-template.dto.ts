import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminAiTaskType, AdminAiTemplateStatus } from './admin-query-ai.dto';

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

export class AdminCreateAiTemplateDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  key!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;

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

  @IsString()
  @Transform(trimRequiredString)
  systemPrompt!: string;

  @IsString()
  @Transform(trimRequiredString)
  userPrompt!: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  model?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  temperature?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: AdminAiTemplateStatus;
}

export class AdminUpdateAiTemplateDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  key?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'STORE_HEALTH_SUMMARY',
    'SALES_INSIGHT',
    'SEO_REVIEW',
    'SUPPORT_SUMMARY',
    'SEARCH_INSIGHT',
    'CUSTOM_PROMPT',
  ])
  taskType?: AdminAiTaskType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userPrompt?: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  model?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  temperature?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: AdminAiTemplateStatus;
}
