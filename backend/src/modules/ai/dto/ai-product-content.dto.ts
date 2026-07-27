import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === false) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false;
  }

  return value;
};

export enum AiProductContentMode {
  FULL = 'FULL',
  SHORT_DESCRIPTION = 'SHORT_DESCRIPTION',
  DESCRIPTION = 'DESCRIPTION',
  SEO = 'SEO',
  FAQ = 'FAQ',
  AD_COPY = 'AD_COPY',
}

export class AiProductContentDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(1, 128)
  productId!: string;

  @IsOptional()
  @IsEnum(AiProductContentMode)
  mode?: AiProductContentMode;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  extraInstruction?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  applyToProduct?: boolean;
}
