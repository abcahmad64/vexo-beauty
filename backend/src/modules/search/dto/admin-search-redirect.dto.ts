import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export type AdminSearchRedirectTargetType =
  'PRODUCT' | 'CATEGORY' | 'BRAND' | 'PAGE' | 'URL';

export class AdminCreateSearchRedirectDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['PRODUCT', 'CATEGORY', 'BRAND', 'PAGE', 'URL'])
  targetType!: AdminSearchRedirectTargetType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  targetId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  targetUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class AdminUpdateSearchRedirectDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PRODUCT', 'CATEGORY', 'BRAND', 'PAGE', 'URL'])
  targetType?: AdminSearchRedirectTargetType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  targetId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  targetUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  clearStartsAt?: boolean;

  @IsOptional()
  @IsBoolean()
  clearEndsAt?: boolean;
}
