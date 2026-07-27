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

export class AdminUpdateCmsFaqDto {
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

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  answer?: string;

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
