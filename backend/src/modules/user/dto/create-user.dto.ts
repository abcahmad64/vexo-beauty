import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { UserStatus } from '../../../generated/prisma';
import {
  normalizePersianArabicDigits,
  trimOptionalString,
  trimString,
} from '../../../core/utils/transformer.util';
import { AuthConstants } from '../../auth/constants/auth.constants';

const normalizeEmail = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase();
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

export class CreateUserDto {
  @Transform(normalizeEmail)
  @IsEmail(
    {},
    {
      message: 'ایمیل واردشده معتبر نیست.',
    },
  )
  @MaxLength(180, {
    message: 'ایمیل نباید بیشتر از ۱۸۰ کاراکتر باشد.',
  })
  email!: string;

  @IsString({
    message: 'رمز عبور باید متن باشد.',
  })
  @MinLength(AuthConstants.PASSWORD_MIN_LENGTH, {
    message: `رمز عبور باید حداقل ${AuthConstants.PASSWORD_MIN_LENGTH} کاراکتر باشد.`,
  })
  @MaxLength(120, {
    message: 'رمز عبور نباید بیشتر از ۱۲۰ کاراکتر باشد.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/u, {
    message:
      'رمز عبور باید حداقل شامل یک حرف کوچک انگلیسی، یک حرف بزرگ انگلیسی و یک عدد باشد.',
  })
  password!: string;

  @Transform(trimString)
  @IsString({
    message: 'نام باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  firstName!: string;

  @Transform(trimString)
  @IsString({
    message: 'نام خانوادگی باید متن باشد.',
  })
  @Length(2, 80, {
    message: 'نام خانوادگی باید بین ۲ تا ۸۰ کاراکتر باشد.',
  })
  lastName!: string;

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
  @MaxLength(128, {
    message: 'شناسه نقش نباید بیشتر از ۱۲۸ کاراکتر باشد.',
  })
  roleId?: string;

  @Transform(normalizeOptionalStatus)
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'وضعیت کاربر معتبر نیست.',
  })
  status?: UserStatus;
}
