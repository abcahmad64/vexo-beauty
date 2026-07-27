import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

import { AdminCouponType } from './admin-query-coupon.dto';

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

export class AdminCouponAiDiscountSuggestDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  campaignGoal?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(300)
  audience?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  subtotal?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(30)
  maxDiscountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(95)
  minMarginPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  daysValid?: number;
}

export class AdminCouponAiDraftDto extends AdminCouponAiDiscountSuggestDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(24)
  codePrefix?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'])
  type?: AdminCouponType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  value?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  minAmount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  usageLimit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;
}

export class AdminCouponAiCreateDto extends AdminCouponAiDraftDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  approvalReason?: string;
}
