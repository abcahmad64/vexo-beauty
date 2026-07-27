import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStringArray = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
};

export class AiArticleDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 300)
  topic!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  brandId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({
    each: true,
  })
  productIds?: string[];

  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({
    each: true,
  })
  keywords?: string[];

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  targetAudience?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  tone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(4000)
  wordCount?: number;
}
