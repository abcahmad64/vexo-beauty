import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 80)
  code?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
