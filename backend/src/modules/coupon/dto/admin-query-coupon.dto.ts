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

export type AdminCouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export type AdminCouponStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type AdminCouponSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'code'
  | 'type'
  | 'value'
  | 'status'
  | 'usedCount'
  | 'usageLimit'
  | 'startDate'
  | 'endDate'
  | 'usageCount'
  | 'revenueAmount';

export type AdminCouponSortDirection = 'asc' | 'desc';

export class AdminQueryCouponDto {
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
  couponId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'])
  type?: AdminCouponType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['ACTIVE', 'INACTIVE', 'EXPIRED'])
  status?: AdminCouponStatus;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  expired?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  scheduled?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  exhausted?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasUsageLimit?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  valueMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  valueMax?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  minAmountMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  minAmountMax?: string;

  @IsOptional()
  @IsDateString()
  startFrom?: string;

  @IsOptional()
  @IsDateString()
  startTo?: string;

  @IsOptional()
  @IsDateString()
  endFrom?: string;

  @IsOptional()
  @IsDateString()
  endTo?: string;

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
    'code',
    'type',
    'value',
    'status',
    'usedCount',
    'usageLimit',
    'startDate',
    'endDate',
    'usageCount',
    'revenueAmount',
  ])
  sortBy?: AdminCouponSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminCouponSortDirection;
}
