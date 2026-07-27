import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const normalizeCouponCode = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase();
};

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

export class ApplyCouponDto {
  @IsString()
  @Transform(normalizeCouponCode)
  @MaxLength(80)
  code!: string;

  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'subtotal must be a decimal string with up to 2 decimal places',
  })
  subtotal!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'shippingAmount must be a decimal string with up to 2 decimal places',
  })
  shippingAmount?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  userId?: string;
}
