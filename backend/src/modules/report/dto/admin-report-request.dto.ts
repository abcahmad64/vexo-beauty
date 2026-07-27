import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

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

export type AdminReportType =
  | 'OVERVIEW'
  | 'SALES'
  | 'ORDERS'
  | 'PAYMENTS'
  | 'CUSTOMERS'
  | 'PRODUCTS'
  | 'COUPONS'
  | 'SUPPORT';

export type AdminReportGroupBy = 'day' | 'week' | 'month';

export class AdminReportRequestDto {
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
}
