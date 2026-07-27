import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  normalizePersianArabicDigits,
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

export class AdminUpdateUserDto {
  @Transform(normalizeOptionalEmail)
  @IsOptional()
  @IsEmail(
    {},
    {
      message: 'ایمیل واردشده معتبر نیست.',
    },
  )
  @MaxLength(180, {
    message: 'ایمیل نباید بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  email?: string;

  @Transform(normalizeOptionalPhone)
  @IsOptional()
  @IsString({
    message: 'شماره موبایل باید متن باشد.',
  })
  @MaxLength(20, {
    message: 'شماره موبایل بیش از حد طولانی است.',
  })
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/u, {
    message: 'شماره موبایل معتبر نیست.',
  })
  phone?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'نام باید متن باشد.',
  })
  @MaxLength(100, {
    message: 'نام نباید بیشتر از ۱۰۰ کاراکتر باشد.',
  })
  firstName?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'نام خانوادگی باید متن باشد.',
  })
  @MaxLength(100, {
    message: 'نام خانوادگی نباید بیشتر از ۱۰۰ کاراکتر باشد.',
  })
  lastName?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'آدرس تصویر پروفایل باید متن باشد.',
  })
  @MaxLength(1000, {
    message: 'آدرس تصویر پروفایل نباید بیشتر از ۱۰۰۰ کاراکتر باشد.',
  })
  avatarUrl?: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({
    message: 'شناسه نقش باید متن باشد.',
  })
  @MaxLength(120, {
    message: 'شناسه نقش نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  roleId?: string;
}
