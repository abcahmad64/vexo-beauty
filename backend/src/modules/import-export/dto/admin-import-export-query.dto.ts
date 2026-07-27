import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export type AdminImportEntity = 'BRAND' | 'CATEGORY' | 'COUPON';

export type AdminExportEntity =
  | 'BRAND'
  | 'CATEGORY'
  | 'COUPON'
  | 'PRODUCT'
  | 'ORDER'
  | 'USER'
  | 'PAYMENT'
  | 'REFUND'
  | 'INVOICE'
  | 'SUPPORT_TICKET'
  | 'SEARCH_LOG'
  | 'AI_RECOMMENDATION'
  | 'SECURITY_INCIDENT';

export type AdminImportMode = 'CREATE' | 'UPDATE' | 'UPSERT';

export type AdminImportExportFormat = 'CSV' | 'JSON';

export type AdminImportJobStatus =
  'PENDING' | 'PREVIEWED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type AdminExportJobStatus =
  'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export class AdminImportExportQueryDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  jobId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
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
  entity?: AdminExportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'PREVIEWED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])
  importStatus?: AdminImportJobStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])
  exportStatus?: AdminExportJobStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  createdById?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
