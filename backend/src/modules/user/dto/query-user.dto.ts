import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { UserStatus } from '../../../generated/prisma';
import {
  normalizePersianArabicDigits,
  toOptionalBoolean,
  toOptionalInteger,
  trimOptionalString,
} from '../../../core/utils/transformer.util';

const normalizeOptionalEmail = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const normalizeOptionalPhone = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = normalizePersianArabicDigits(value)
    .trim()
    .replace(/[\s\-()]/gu, '');

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const normalizeOptionalStatus = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toUpperCase();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

export class QueryUserDto {
  @Transform(toOptionalInteger)
  @IsOptional()
  @IsInt({
    message: 'شماره صفحه باید عدد صحیح باشد.',
  })
  @Min(1, {
    message: 'شماره صفحه باید حداقل ۱ باشد.',
  })
  page?: number;

  @Transform(toOptionalInteger)
  @IsOptional()
  @IsInt({
    message: 'تعداد آیتم‌ها باید عدد صحیح باشد.',
  })
  @Min(1, {
    message: 'تعداد آیتم‌ها باید حداقل ۱ باشد.',
  })
  @Max(100, {
    message: 'تعداد آیتم‌ها نباید بیشتر از ۱۰۰ باشد.',
  })
  limit?: number;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'عبارت جستجو باید متن باشد.',
  })
  @MaxLength(300, {
    message: 'عبارت جستجو نباید بیشتر از ۳۰۰ کاراکتر باشد.',
  })
  q?: string;

  @Transform(normalizeOptionalEmail)
  @IsOptional()
  @IsString({
    message: 'ایمیل باید متن باشد.',
  })
  @MaxLength(180, {
    message: 'ایمیل نباید بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  email?: string;

  @Transform(normalizeOptionalPhone)
  @IsOptional()
  @IsString({
    message: 'شماره موبایل باید متن باشد.',
  })
  @MaxLength(40, {
    message: 'شماره موبایل نباید بیشتر از ۴۰ کاراکتر باشد.',
  })
  phone?: string;

  @Transform(normalizeOptionalStatus)
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'وضعیت کاربر معتبر نیست.',
  })
  status?: UserStatus;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'شناسه نقش باید متن باشد.',
  })
  @MaxLength(128, {
    message: 'شناسه نقش نباید بیشتر از ۱۲۸ کاراکتر باشد.',
  })
  roleId?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'نام نقش باید متن باشد.',
  })
  @MaxLength(80, {
    message: 'نام نقش نباید بیشتر از ۸۰ کاراکتر باشد.',
  })
  roleName?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'تاریخ شروع ایجاد کاربر معتبر نیست.',
    },
  )
  createdFrom?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'تاریخ پایان ایجاد کاربر معتبر نیست.',
    },
  )
  createdTo?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'فیلتر نمایش حذف‌شده‌ها باید بولین باشد.',
  })
  includeDeleted?: boolean;
}
