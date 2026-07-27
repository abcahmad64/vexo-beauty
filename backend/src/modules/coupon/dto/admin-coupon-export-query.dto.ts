import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminCouponStatus, AdminCouponType } from './admin-query-coupon.dto';

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

export type AdminCouponExportFormat = 'csv' | 'json';

export class AdminCouponExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

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
  @MaxLength(10)
  @IsIn(['csv', 'json'])
  format?: AdminCouponExportFormat;
}
