import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminReportGroupBy,
  AdminReportType,
} from './admin-report-request.dto';

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

export type AdminReportExportFormat = 'csv' | 'json';

export class AdminReportExportQueryDto {
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'OVERVIEW',
    'SALES',
    'ORDERS',
    'PAYMENTS',
    'CUSTOMERS',
    'PRODUCTS',
    'COUPONS',
    'SUPPORT',
  ])
  reportType!: AdminReportType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['day', 'week', 'month'])
  groupBy?: AdminReportGroupBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  currency?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminReportExportFormat;
}
