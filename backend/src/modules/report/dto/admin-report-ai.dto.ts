import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

const reportSections = [
  'orders',
  'payments',
  'refunds',
  'inventory',
  'coupons',
  'content',
  'audit',
] as const;

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

const normalizeSections = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value as unknown[];
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
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

export class AdminReportAiStoreHealthDto {
  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdFrom?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Transform(normalizeSections)
  @IsArray()
  @IsIn(reportSections, {
    each: true,
  })
  sections?: Array<(typeof reportSections)[number]>;
}

export class AdminReportAiSalesInsightDto {
  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdFrom?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(16)
  currency?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  comparePreviousPeriod?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topProductsLimit?: number;
}

export class AdminReportAiOrderSummaryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  orderId?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdFrom?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(trimOptionalString)
  createdTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeTimeline?: boolean;
}
