import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimOptionalNullableString = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
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

export class AdminUpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
