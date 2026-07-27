import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class AdminUpdateBrandDto {
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
  @IsString()
  @Transform(trimOptionalString)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  website?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
