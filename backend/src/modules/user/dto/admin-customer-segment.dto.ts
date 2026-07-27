import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  toOptionalBoolean,
  trimOptionalString,
} from '../../../core/utils/transformer.util';

export type AdminCustomerVipLevel =
  'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

const ADMIN_CUSTOMER_VIP_LEVELS: readonly AdminCustomerVipLevel[] = [
  'none',
  'bronze',
  'silver',
  'gold',
  'platinum',
] as const;

const normalizeOptionalStringArray = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  let values: unknown[];

  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string') {
    values = value.split(',');
  } else {
    return value;
  }

  const normalizedValues = values
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => (typeof item === 'string' ? item.length > 0 : true));

  return normalizedValues.length > 0 ? normalizedValues : undefined;
};

export class AdminCustomerSegmentDto {
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'سگمنت مشتری باید متن باشد.',
  })
  @MaxLength(120, {
    message: 'سگمنت مشتری نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  segment?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'سطح VIP باید متن باشد.',
  })
  @IsIn(ADMIN_CUSTOMER_VIP_LEVELS, {
    message: 'سطح VIP معتبر نیست.',
  })
  vipLevel?: AdminCustomerVipLevel;

  @Transform(normalizeOptionalStringArray)
  @IsOptional()
  @IsArray({
    message: 'برچسب‌ها باید آرایه باشند.',
  })
  @ArrayMaxSize(50, {
    message: 'تعداد برچسب‌ها نباید بیشتر از ۵۰ مورد باشد.',
  })
  @IsString({
    each: true,
    message: 'هر برچسب باید متن باشد.',
  })
  @MaxLength(80, {
    each: true,
    message: 'هر برچسب نباید بیشتر از ۸۰ کاراکتر باشد.',
  })
  tags?: string[];

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'وضعیت اجازه بازاریابی باید بولین باشد.',
  })
  marketingAllowed?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'وضعیت ریسک مشتری باید بولین باشد.',
  })
  highRisk?: boolean;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'دلیل تغییر سگمنت باید متن باشد.',
  })
  @MaxLength(500, {
    message: 'دلیل تغییر سگمنت نباید بیشتر از ۵۰۰ کاراکتر باشد.',
  })
  reason?: string;
}
