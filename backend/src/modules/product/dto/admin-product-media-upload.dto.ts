import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminProductMediaType } from './admin-product-media.dto';

const mediaTypes: AdminProductMediaType[] = ['IMAGE', 'VIDEO'];

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

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return value;
};

const toOptionalInteger = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
};

export class AdminUploadProductMediaDto {
  @IsOptional()
  @IsString()
  @IsIn(mediaTypes)
  @Transform(trimOptionalString)
  type?: AdminProductMediaType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  altText?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(toOptionalInteger)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  isActive?: boolean;
}

export class AdminBulkUploadProductMediaDto {
  @IsOptional()
  @IsString()
  @IsIn(mediaTypes)
  @Transform(trimOptionalString)
  type?: AdminProductMediaType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(49)
  @Transform(toOptionalInteger)
  primaryIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(toOptionalInteger)
  startSortOrder?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(toOptionalBoolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  titlePrefix?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  altTextPrefix?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  caption?: string;
}
