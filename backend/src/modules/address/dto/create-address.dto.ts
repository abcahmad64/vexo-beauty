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
  trimString,
  toOptionalBoolean,
} from '../../../core/utils/transformer.util';

const normalizeRequiredPhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return normalizePersianArabicDigits(value).trim();
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

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  title?: string;

  @IsString()
  @Transform(trimString)
  @Length(2, 80)
  firstName!: string;

  @IsString()
  @Transform(trimString)
  @Length(2, 80)
  lastName!: string;

  @IsString()
  @Transform(normalizeRequiredPhone)
  @Matches(/^[0-9+\-\s()]{7,30}$/, {
    message:
      'شماره تماس باید فقط شامل عدد، فاصله، +، -، پرانتز باشد و بین ۷ تا ۳۰ کاراکتر داشته باشد.',
  })
  phone!: string;

  @IsString()
  @Transform(trimString)
  @Length(2, 80)
  country!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  state?: string;

  @IsString()
  @Transform(trimString)
  @Length(2, 80)
  city!: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalDigitsString)
  @MaxLength(30)
  postalCode?: string;

  @IsString()
  @Transform(trimString)
  @Length(3, 255)
  street!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  apartment?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;
}
