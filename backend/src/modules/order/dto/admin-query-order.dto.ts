import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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

export type AdminOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type AdminOrderPaymentStatus =
  'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUNDED';

export type AdminOrderPaymentMethod =
  'ZARINPAL' | 'IDPAY' | 'CASH' | 'CARD' | 'WALLET';

export type AdminOrderSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'orderNumber'
  | 'status'
  | 'paymentStatus'
  | 'totalAmount'
  | 'userEmail'
  | 'itemCount'
  | 'paidAmount'
  | 'shippedAt'
  | 'deliveredAt';

export type AdminOrderSortDirection = 'asc' | 'desc';

export class AdminQueryOrderDto {
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
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ])
  status?: AdminOrderStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus?: AdminOrderPaymentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ZARINPAL', 'IDPAY', 'CASH', 'CARD', 'WALLET'])
  paymentMethod?: AdminOrderPaymentMethod;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  totalMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  totalMax?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasTrackingNumber?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasInvoice?: boolean;

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

  @IsOptional()
  @IsDateString()
  shippedFrom?: string;

  @IsOptional()
  @IsDateString()
  shippedTo?: string;

  @IsOptional()
  @IsDateString()
  deliveredFrom?: string;

  @IsOptional()
  @IsDateString()
  deliveredTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'orderNumber',
    'status',
    'paymentStatus',
    'totalAmount',
    'userEmail',
    'itemCount',
    'paidAmount',
    'shippedAt',
    'deliveredAt',
  ])
  sortBy?: AdminOrderSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminOrderSortDirection;
}
