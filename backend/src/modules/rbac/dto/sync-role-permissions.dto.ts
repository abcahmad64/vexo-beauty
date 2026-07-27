import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
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

export type SyncRolePermissionsMode = 'replace' | 'append' | 'remove';

export class SyncRolePermissionsDto {
  @IsString()
  @IsIn(['replace', 'append', 'remove'])
  mode!: SyncRolePermissionsMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({
    each: true,
  })
  permissionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({
    each: true,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
      .filter((item) => typeof item === 'string' && item.length > 0);
  })
  permissionNames?: string[];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  reason?: string;
}
