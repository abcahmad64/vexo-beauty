import { IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

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

export class AdminUpdateOrderDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  shippingAddressId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  billingAddressId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(2000)
  notes?: string;
}
