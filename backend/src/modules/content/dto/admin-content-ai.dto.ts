import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
};

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

const normalizeOptionalStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value as unknown[];
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
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

export class AdminContentAiArticleDraftDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(220)
  topic!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(12)
  language?: string;

  @IsOptional()
  @Transform(normalizeOptionalStringArray)
  @IsArray()
  @IsString({
    each: true,
  })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  tone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(300)
  @Max(2500)
  wordCount?: number;

  @IsOptional()
  @Transform(normalizeOptionalStringArray)
  @IsArray()
  @IsString({
    each: true,
  })
  productIds?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  extraInstruction?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  noIndex?: boolean;
}

export class AdminContentAiArticlePublishDto extends AdminContentAiArticleDraftDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  approvalReason?: string;
}
