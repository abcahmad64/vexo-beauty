import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
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

export class CreateMetricDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 160)
  name!: string;

  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^-?\d+(\.\d{1,4})?$/, {
    message: 'value must be a decimal string with up to 4 decimal places',
  })
  value!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50)
  unit?: string;

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
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
