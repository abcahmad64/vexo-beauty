import { IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export class AdminValidateCouponDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(80)
  code!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(40)
  subtotal!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  shippingAmount?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;
}
