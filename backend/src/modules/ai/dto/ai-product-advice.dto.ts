import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
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

export class AiProductAdviceDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 2000)
  request!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  brandId?: string;

  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({
    each: true,
  })
  productIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  skinType?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  hairType?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  concern?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  deviceNeed?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
