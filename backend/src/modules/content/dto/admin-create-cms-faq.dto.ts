import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminCmsStatus } from './admin-query-content.dto';

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

export class AdminCreateCmsFaqDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  category?: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(500)
  question!: string;

  @IsString()
  @Transform(trimRequiredString)
  answer!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: AdminCmsStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
