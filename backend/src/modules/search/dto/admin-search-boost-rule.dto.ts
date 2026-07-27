import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
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

export type AdminSearchBoostEntityType =
  'PRODUCT' | 'CATEGORY' | 'BRAND' | 'PAGE';

export class AdminCreateSearchBoostRuleDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['PRODUCT', 'CATEGORY', 'BRAND', 'PAGE'])
  entityType!: AdminSearchBoostEntityType;

  @IsString()
  @Transform(trimRequiredString)
  entityId!: string;

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
  @MaxLength(40)
  weight?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;

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

export class AdminUpdateSearchBoostRuleDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['PRODUCT', 'CATEGORY', 'BRAND', 'PAGE'])
  entityType?: AdminSearchBoostEntityType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  entityId?: string;

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
  @MaxLength(40)
  weight?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;

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
