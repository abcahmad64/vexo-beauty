import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminCmsEntity, AdminCmsStatus } from './admin-query-content.dto';

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

export type AdminContentExportFormat = 'csv' | 'json';

export class AdminContentExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['pages', 'blocks', 'faqs'])
  entity?: AdminCmsEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: AdminCmsStatus;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminContentExportFormat;
}
