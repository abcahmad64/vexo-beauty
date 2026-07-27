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

export type AdminInvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export type AdminInvoicePaymentStatus =
  'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUNDED';

export type AdminInvoiceSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'issuedAt'
  | 'dueDate'
  | 'invoiceNumber'
  | 'amount'
  | 'status'
  | 'paymentStatus'
  | 'orderNumber'
  | 'userEmail';

export type AdminInvoiceSortDirection = 'asc' | 'desc';

export class AdminQueryInvoiceDto {
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
  invoiceId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  orderId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  paymentId?: string;

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
  @IsIn(['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'])
  status?: AdminInvoiceStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUNDED'])
  paymentStatus?: AdminInvoicePaymentStatus;

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
  hasPdf?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  overdueOnly?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  issuedFrom?: string;

  @IsOptional()
  @IsDateString()
  issuedTo?: string;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'issuedAt',
    'dueDate',
    'invoiceNumber',
    'amount',
    'status',
    'paymentStatus',
    'orderNumber',
    'userEmail',
  ])
  sortBy?: AdminInvoiceSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminInvoiceSortDirection;
}
