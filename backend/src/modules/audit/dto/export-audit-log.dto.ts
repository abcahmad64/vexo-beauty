import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

export class ExportAuditLogDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  action?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  entityId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  actorId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  severity?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
