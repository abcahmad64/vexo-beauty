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

export type AdminSupportExportEntity = 'tickets' | 'chats';

export type AdminSupportExportFormat = 'csv' | 'json';

export class AdminSupportExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['tickets', 'chats'])
  entity?: AdminSupportExportEntity;

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
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminSupportExportFormat;
}
