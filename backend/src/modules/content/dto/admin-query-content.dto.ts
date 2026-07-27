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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
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

export type AdminCmsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type AdminCmsVisibility = 'PUBLIC' | 'PRIVATE';

export type AdminCmsEntity = 'pages' | 'blocks' | 'faqs';

export type AdminCmsSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'publishedAt'
  | 'title'
  | 'slug'
  | 'key'
  | 'status'
  | 'language'
  | 'sortOrder'
  | 'placement'
  | 'category';

export type AdminCmsSortDirection = 'asc' | 'desc';

export class AdminQueryContentDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
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
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  key?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  placement?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  category?: string;

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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  publishedFrom?: string;

  @IsOptional()
  @IsDateString()
  publishedTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'publishedAt',
    'title',
    'slug',
    'key',
    'status',
    'language',
    'sortOrder',
    'placement',
    'category',
  ])
  sortBy?: AdminCmsSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminCmsSortDirection;
}
