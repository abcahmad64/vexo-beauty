import {
  IsEmpty,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { PaymentMethod } from '../../../generated/prisma';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

export class InitiatePaymentDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  orderId!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsEmpty({
    message: 'مبلغ پرداخت فقط توسط سامانه محاسبه می‌شود.',
  })
  amount?: never;

  @IsEmpty({
    message: 'واحد پول پرداخت فقط توسط سامانه تعیین می‌شود.',
  })
  currency?: never;

  @IsEmpty({
    message: 'شرح پرداخت فقط توسط سامانه تعیین می‌شود.',
  })
  description?: never;

  @IsEmpty({
    message: 'اطلاعات داخلی پرداخت از سمت کاربر پذیرفته نمی‌شود.',
  })
  metadata?: never;
}
