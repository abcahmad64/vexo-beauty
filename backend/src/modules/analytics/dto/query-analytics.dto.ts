import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export type AnalyticsGroupBy = 'hour' | 'day' | 'week' | 'month' | 'year';

export type AnalyticsSortOrder = 'asc' | 'desc';

export type AnalyticsEntityType =
  | 'event'
  | 'metric'
  | 'product'
  | 'order'
  | 'payment'
  | 'user'
  | 'cart'
  | 'wishlist'
  | 'review'
  | 'coupon'
  | 'inventory'
  | 'search'
  | 'notification'
  | 'ai';

export type AnalyticsProductStatus =
  'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type AnalyticsOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type AnalyticsPaymentStatus =
  'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUNDED';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function toNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function trimString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

export class QueryAnalyticsDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  from?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  productId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  orderId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  paymentId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  sessionId?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  source?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  medium?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  campaign?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn([
    'event',
    'metric',
    'product',
    'order',
    'payment',
    'user',
    'cart',
    'wishlist',
    'review',
    'coupon',
    'inventory',
    'search',
    'notification',
    'ai',
  ])
  entityType?: AnalyticsEntityType;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  productStatus?: AnalyticsProductStatus;

  @IsOptional()
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ])
  orderStatus?: AnalyticsOrderStatus;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus?: AnalyticsPaymentStatus;

  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month', 'year'])
  groupBy?: AnalyticsGroupBy = 'day';

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: AnalyticsSortOrder = 'desc';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: AnalyticsSortOrder = 'desc';

  @IsOptional()
  @Transform(({ value }) => toNumber(value, 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => toNumber(value, 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeSummary?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeComparison?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  comparisonDays?: number;
}
