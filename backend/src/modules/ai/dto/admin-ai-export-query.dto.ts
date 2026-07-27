import { IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminAiTaskType } from './admin-query-ai.dto';

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

export type AdminAiExportEntity =
  'runs' | 'templates' | 'knowledge' | 'guardrails' | 'recommendations';

export type AdminAiExportFormat = 'csv' | 'json';

export class AdminAiExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['runs', 'templates', 'knowledge', 'guardrails', 'recommendations'])
  entity?: AdminAiExportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

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
  @IsIn(['csv', 'json'])
  format?: AdminAiExportFormat;
}
