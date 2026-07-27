import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  normalizePersianArabicDigits,
  trimOptionalString,
  toOptionalBoolean,
} from '../../../core/utils/transformer.util';

const normalizeOptionalPhone = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = normalizePersianArabicDigits(value).trim();

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeNullableString = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
};

const normalizeNullableDigitsString = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = normalizePersianArabicDigits(value).trim();

  return normalized.length > 0 ? normalized : null;
};

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @Transform(normalizeNullableString)
  @MaxLength(80)
  title?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalPhone)
  @Matches(/^[0-9+\-\s()]{7,30}$/, {
    message:
      'شماره تماس باید فقط شامل عدد، فاصله، +، -، پرانتز باشد و بین ۷ تا ۳۰ کاراکتر داشته باشد.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 80)
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeNullableString)
  @MaxLength(80)
  state?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 80)
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeNullableDigitsString)
  @MaxLength(30)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(3, 255)
  street?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeNullableString)
  @MaxLength(120)
  apartment?: string | null;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;
}
