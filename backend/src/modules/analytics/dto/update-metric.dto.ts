import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
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

export class UpdateMetricDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^-?\d+(\.\d{1,4})?$/, {
    message: 'value must be a decimal string with up to 4 decimal places',
  })
  value?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(50)
  unit?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
