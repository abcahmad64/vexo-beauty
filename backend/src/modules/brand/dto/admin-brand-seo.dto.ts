import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

export class AdminBrandSeoDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(320)
  metaDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({
    each: true,
  })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  ogTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(320)
  ogDescription?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ogImage?: string;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @IsBoolean()
  noFollow?: boolean;
}
