import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminImportEntity,
  AdminImportMode,
  AdminImportExportFormat,
} from './admin-import-export-query.dto';

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

export class AdminCreateImportJobDto {
  @IsString()
  @IsIn(['BRAND', 'CATEGORY', 'COUPON'])
  entity!: AdminImportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['CREATE', 'UPDATE', 'UPSERT'])
  mode?: AdminImportMode;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['CSV', 'JSON'])
  sourceFormat?: AdminImportExportFormat;

  @IsArray()
  @ArrayMaxSize(5000)
  rows!: Array<Record<string, unknown>>;
}
