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
    return value
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean);
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

export class AdminMarketingAiBaseRangeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  createdFrom?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(12)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AdminMarketingStrategyAiDto extends AdminMarketingAiBaseRangeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  campaignGoal?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  audience?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  channel?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  focus?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  productId?: string;

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
  @Transform(normalizeOptionalStringArray)
  @IsArray()
  @IsString({
    each: true,
  })
  keywords?: string[];
}

export class AdminDemandAnalysisAiDto extends AdminMarketingAiBaseRangeDto {
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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeSearch?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeInventory?: boolean;
}

export class AdminProductRecommendationAiDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  productId?: string;

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
  @MaxLength(160)
  scenario?: string;

  @IsOptional()
  @Transform(normalizeOptionalStringArray)
  @IsArray()
  @IsString({
    each: true,
  })
  keywords?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}

export class AdminSearchInsightAiDto extends AdminMarketingAiBaseRangeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  query?: string;

  @IsOptional()
  @IsIn(['all', 'products', 'categories', 'brands', 'global'])
  scope?: string;
}
