import { IsIn, IsOptional, IsString } from 'class-validator';

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

export type AdminSecurityExportEntity =
  'incidents' | 'policies' | 'ip-rules' | 'evaluations';

export type AdminSecurityExportFormat = 'csv' | 'json';

export class AdminSecurityExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['incidents', 'policies', 'ip-rules', 'evaluations'])
  entity?: AdminSecurityExportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  status?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  severity?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminSecurityExportFormat;
}
