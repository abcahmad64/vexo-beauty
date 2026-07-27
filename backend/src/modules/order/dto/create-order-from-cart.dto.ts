import {
  IsBoolean,
  IsEmpty,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

import { PaymentMethod } from '../../../generated/prisma';

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

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class CheckoutAddressDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80, {
    message: 'عنوان آدرس بیش از حد طولانی است.',
  })
  title?: string;

  @IsString({
    message: 'نام گیرنده الزامی است.',
  })
  @Transform(trimRequiredString)
  @MinLength(2, {
    message: 'نام گیرنده باید حداقل ۲ کاراکتر باشد.',
  })
  @MaxLength(80, {
    message: 'نام گیرنده بیش از حد طولانی است.',
  })
  firstName!: string;

  @IsString({
    message: 'نام خانوادگی گیرنده الزامی است.',
  })
  @Transform(trimRequiredString)
  @MinLength(2, {
    message: 'نام خانوادگی گیرنده باید حداقل ۲ کاراکتر باشد.',
  })
  @MaxLength(80, {
    message: 'نام خانوادگی گیرنده بیش از حد طولانی است.',
  })
  lastName!: string;

  @IsString({
    message: 'شماره تماس گیرنده الزامی است.',
  })
  @Transform(trimRequiredString)
  @MaxLength(30, {
    message: 'شماره تماس بیش از حد طولانی است.',
  })
  @Matches(/^[0-9۰-۹٠-٩+\-\s()]{7,30}$/, {
    message: 'شماره تماس گیرنده معتبر نیست.',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80, {
    message: 'کشور بیش از حد طولانی است.',
  })
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80, {
    message: 'استان بیش از حد طولانی است.',
  })
  state?: string;

  @IsString({
    message: 'شهر الزامی است.',
  })
  @Transform(trimRequiredString)
  @MinLength(2, {
    message: 'شهر باید حداقل ۲ کاراکتر باشد.',
  })
  @MaxLength(80, {
    message: 'شهر بیش از حد طولانی است.',
  })
  city!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(20, {
    message: 'کد پستی بیش از حد طولانی است.',
  })
  postalCode?: string;

  @IsString({
    message: 'آدرس کامل الزامی است.',
  })
  @Transform(trimRequiredString)
  @MinLength(5, {
    message: 'آدرس کامل باید حداقل ۵ کاراکتر باشد.',
  })
  @MaxLength(500, {
    message: 'آدرس کامل بیش از حد طولانی است.',
  })
  street!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120, {
    message: 'پلاک، واحد یا توضیحات تکمیلی بیش از حد طولانی است.',
  })
  apartment?: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}

export class CreateOrderFromCartDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  shippingAddressId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  billingAddressId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billingAddress?: CheckoutAddressDto;

  @IsOptional()
  @IsBoolean()
  useShippingAsBilling?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  shippingMethod?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEmpty({
    message: 'مبلغ مالیات فقط توسط سامانه محاسبه می‌شود.',
  })
  taxAmount?: never;

  @IsOptional()
  @IsEmpty({
    message: 'هزینه ارسال فقط توسط سامانه محاسبه می‌شود.',
  })
  shippingAmount?: never;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEmpty({
    message: 'واحد پول سفارش توسط سامانه تعیین می‌شود.',
  })
  currency?: never;
}
