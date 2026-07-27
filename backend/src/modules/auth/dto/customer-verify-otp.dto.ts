import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

import { normalizePersianArabicDigits } from '../../../core/utils/transformer.util';

const normalizePhoneInput = ({
  value,
}: {
  readonly value: unknown;
}): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return normalizePersianArabicDigits(value)
    .trim()
    .replace(/[\s\-()]/gu, '');
};

const normalizeOtpCode = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return normalizePersianArabicDigits(value).trim();
};

export class CustomerVerifyOtpDto {
  @Transform(normalizePhoneInput)
  @IsString({
    message: 'شماره موبایل الزامی است.',
  })
  @MaxLength(20, {
    message: 'شماره موبایل بیش از حد طولانی است.',
  })
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/u, {
    message: 'شماره موبایل معتبر نیست.',
  })
  phone!: string;

  @Transform(normalizeOtpCode)
  @IsString({
    message: 'کد تأیید الزامی است.',
  })
  @Matches(/^\d{6}$/u, {
    message: 'کد تأیید باید ۶ رقم باشد.',
  })
  code!: string;
}
