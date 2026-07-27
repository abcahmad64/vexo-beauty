import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminCmsStatus, AdminCmsVisibility } from './admin-query-content.dto';

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

export class AdminUpdateCmsPageDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  body?: string;

  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: AdminCmsStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: AdminCmsVisibility;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ogImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsBoolean()
  clearPublishedAt?: boolean;
}
