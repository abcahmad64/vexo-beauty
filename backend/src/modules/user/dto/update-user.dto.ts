import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { normalizePersianArabicDigits } from '../../../core/utils/transformer.util';

const normalizeOptionalNullableEmail = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue.length > 0 ? normalizedValue : null;
};

const normalizeOptionalNullableString = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
};

const normalizeOptionalNullablePhone = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = normalizePersianArabicDigits(value)
    .trim()
    .replace(/[\s\-()]/gu, '');

  return normalizedValue.length > 0 ? normalizedValue : null;
};

export class UpdateUserDto {
  @Transform(normalizeOptionalNullableEmail)
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
  email?: string | null;

  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'نام باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  firstName?: string | null;

  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'نام خانوادگی باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام خانوادگی باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  lastName?: string | null;

  @Transform(normalizeOptionalNullablePhone)
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
  phone?: string | null;

  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'آدرس تصویر پروفایل باید متن باشد.',
  })
  @MaxLength(1000, {
    message: 'آدرس تصویر پروفایل نباید بیشتر از ۱۰۰۰ کاراکتر باشد.',
  })
  avatarUrl?: string | null;

  @Transform(normalizeOptionalNullableString)
  @IsOptional()
  @IsString({
    message: 'شناسه نقش باید متن باشد.',
  })
  @MaxLength(128, {
    message: 'شناسه نقش نباید بیشتر از ۱۲۸ کاراکتر باشد.',
  })
  roleId?: string | null;
}
