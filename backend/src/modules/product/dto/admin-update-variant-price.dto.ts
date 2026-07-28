import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

/* ADMIN_VARIANT_NULLABLE_PRICE_V1 */

const trimNullablePrice = ({
  value,
}: {
  value: unknown;
}) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const trimOptionalString = ({
  value,
}: {
  value: unknown;
}) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminUpdateVariantPriceDto {
  @IsOptional()
  @IsString()
  @Transform(trimNullablePrice)
  @Matches(/^\d+(\.\d{1,2})?$/)
  price?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimNullablePrice)
  @Matches(/^\d+(\.\d{1,2})?$/)
  comparePrice?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
