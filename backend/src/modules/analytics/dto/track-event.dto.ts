import {
  IsDateString,
  IsObject,
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

export class TrackEventDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
