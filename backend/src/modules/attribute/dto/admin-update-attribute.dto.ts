import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  ProductAttributeDataType,
  ProductAttributeInputType,
} from '../../../generated/prisma';

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
      .filter((item) => (typeof item === 'string' ? item.length > 0 : true));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return value;
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

export class AdminUpdateAttributeDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(ProductAttributeDataType)
  dataType?: ProductAttributeDataType;

  @IsOptional()
  @IsEnum(ProductAttributeInputType)
  inputType?: ProductAttributeInputType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @Transform(normalizeOptionalStringArray)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  helpText?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isComparable?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isSeoImportant?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isAiImportant?: boolean;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}
