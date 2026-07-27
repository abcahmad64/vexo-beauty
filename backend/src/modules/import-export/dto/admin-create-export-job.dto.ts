import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminExportEntity,
  AdminImportExportFormat,
} from './admin-import-export-query.dto';

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

export class AdminCreateExportJobDto {
  @IsString()
  @IsIn([
    'BRAND',
    'CATEGORY',
    'COUPON',
    'PRODUCT',
    'ORDER',
    'USER',
    'PAYMENT',
    'REFUND',
    'INVOICE',
    'SUPPORT_TICKET',
    'SEARCH_LOG',
    'AI_RECOMMENDATION',
    'SECURITY_INCIDENT',
  ])
  entity!: AdminExportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['CSV', 'JSON'])
  format?: AdminImportExportFormat;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
