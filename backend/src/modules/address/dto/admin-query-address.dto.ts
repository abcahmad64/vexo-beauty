import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  normalizePersianArabicDigits,
  trimOptionalString,
  toOptionalBoolean,
  toOptionalInteger,
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

export type AdminAddressSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'city'
  | 'country'
  | 'firstName'
  | 'lastName'
  | 'postalCode'
  | 'isDefault'
  | 'userEmail';

export type AdminAddressSortDirection = 'asc' | 'desc';

export class AdminQueryAddressDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalPhone)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  country?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  state?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalDigitsString)
  postalCode?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  @Transform(trimOptionalString)
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  @Transform(trimOptionalString)
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'city',
    'country',
    'firstName',
    'lastName',
    'postalCode',
    'isDefault',
    'userEmail',
  ])
  sortBy?: AdminAddressSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminAddressSortDirection;
}
