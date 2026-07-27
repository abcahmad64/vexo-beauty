import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { MediaFileKind, MediaFolder } from '../constants/media.constants';

import { AdminMediaEntityType } from './admin-query-media.dto';

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

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export class AdminUploadMediaDto {
  @IsOptional()
  @IsEnum(MediaFolder)
  folder?: MediaFolder;

  @IsOptional()
  @IsEnum(MediaFileKind)
  kind?: MediaFileKind;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  entityId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'PRODUCT_IMAGE',
    'BRAND_LOGO',
    'CATEGORY_IMAGE',
    'VARIANT_IMAGE',
    'USER_AVATAR',
  ])
  entityType?: AdminMediaEntityType;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  attachToEntity?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  deleteOldFile?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(300)
  altText?: string;
}
