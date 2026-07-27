import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalSlug = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : null;
};

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalSlug)
  @Length(2, 160)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  logoUrl?: string | null;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  @Transform(trimOptionalString)
  @MaxLength(1000)
  website?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
