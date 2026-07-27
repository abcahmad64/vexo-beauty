import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
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

const normalizeOptionalDigitsString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = normalizePersianArabicDigits(value).trim();

  return normalized.length > 0 ? normalized : undefined;
};

export class AdminUpdateAddressDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalPhone)
  @MaxLength(30)
  @Matches(/^[0-9+\-\s()]{7,30}$/, {
    message:
      'شماره تماس باید فقط شامل عدد، فاصله، +، -، پرانتز باشد و بین ۷ تا ۳۰ کاراکتر داشته باشد.',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalDigitsString)
  @MaxLength(30)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  street?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(300)
  apartment?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;
}
