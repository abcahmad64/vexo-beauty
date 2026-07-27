import { Transform } from 'class-transformer';
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

import {
  normalizePersianArabicDigits,
  toOptionalBoolean,
  toOptionalInteger,
  trimOptionalString,
} from '../../../core/utils/transformer.util';

export type AdminUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';

export type AdminUserSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'status'
  | 'orderCount'
  | 'totalSpent'
  | 'lastOrderAt'
  | 'lastLoginAt';

export type AdminUserSortDirection = 'asc' | 'desc';

const ADMIN_USER_STATUSES: readonly AdminUserStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'DELETED',
] as const;

const ADMIN_USER_SORT_FIELDS: readonly AdminUserSortBy[] = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'status',
  'orderCount',
  'totalSpent',
  'lastOrderAt',
  'lastLoginAt',
] as const;

const ADMIN_USER_SORT_DIRECTIONS: readonly AdminUserSortDirection[] = [
  'asc',
  'desc',
] as const;

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

const normalizeOptionalSortDirection = ({
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

export class AdminQueryUserDto {
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
  @Max(200, {
    message: 'تعداد آیتم‌ها نباید بیشتر از ۲۰۰ باشد.',
  })
  limit?: number;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'عبارت جستجو باید متن باشد.',
  })
  @MaxLength(200, {
    message: 'عبارت جستجو نباید بیشتر از ۲۰۰ کاراکتر باشد.',
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
  @MaxLength(30, {
    message: 'شماره موبایل نباید بیشتر از ۳۰ کاراکتر باشد.',
  })
  phone?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'شناسه نقش باید متن باشد.',
  })
  @MaxLength(120, {
    message: 'شناسه نقش نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  roleId?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'نام نقش باید متن باشد.',
  })
  @MaxLength(120, {
    message: 'نام نقش نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  roleName?: string;

  @Transform(normalizeOptionalStatus)
  @IsOptional()
  @IsString({
    message: 'وضعیت کاربر باید متن باشد.',
  })
  @IsIn(ADMIN_USER_STATUSES, {
    message: 'وضعیت کاربر معتبر نیست.',
  })
  status?: AdminUserStatus;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'فیلتر داشتن سفارش باید بولین باشد.',
  })
  hasOrders?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'فیلتر داشتن پرداخت باید بولین باشد.',
  })
  hasPayments?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean({
    message: 'فیلتر نمایش حذف‌شده‌ها باید بولین باشد.',
  })
  includeDeleted?: boolean;

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

  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'تاریخ شروع آخرین ورود معتبر نیست.',
    },
  )
  lastLoginFrom?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'تاریخ پایان آخرین ورود معتبر نیست.',
    },
  )
  lastLoginTo?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'فیلد مرتب‌سازی باید متن باشد.',
  })
  @IsIn(ADMIN_USER_SORT_FIELDS, {
    message: 'فیلد مرتب‌سازی معتبر نیست.',
  })
  sortBy?: AdminUserSortBy;

  @Transform(normalizeOptionalSortDirection)
  @IsOptional()
  @IsString({
    message: 'جهت مرتب‌سازی باید متن باشد.',
  })
  @IsIn(ADMIN_USER_SORT_DIRECTIONS, {
    message: 'جهت مرتب‌سازی معتبر نیست.',
  })
  sortDirection?: AdminUserSortDirection;
}
