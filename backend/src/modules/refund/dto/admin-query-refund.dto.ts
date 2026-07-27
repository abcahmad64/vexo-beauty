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

export type AdminRefundStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AdminRefundPaymentStatus =
  'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUNDED';

export type AdminRefundSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'processedAt'
  | 'amount'
  | 'status'
  | 'paymentStatus'
  | 'orderNumber'
  | 'userEmail';

export type AdminRefundSortDirection = 'asc' | 'desc';

export class AdminQueryRefundDto {
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
  refundId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  paymentId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderId?: string;

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
  transactionId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
  status?: AdminRefundStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus?: AdminRefundPaymentStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  amountMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  amountMax?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  processedOnly?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  processedFrom?: string;

  @IsOptional()
  @IsDateString()
  processedTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'processedAt',
    'amount',
    'status',
    'paymentStatus',
    'orderNumber',
    'userEmail',
  ])
  sortBy?: AdminRefundSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminRefundSortDirection;
}
