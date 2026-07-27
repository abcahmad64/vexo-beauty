import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const normalizeRoleName = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/\s+/g, '_').toUpperCase();
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

export class CreateRoleDto {
  @IsString()
  @Transform(normalizeRoleName)
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({
    each: true,
  })
  permissionIds?: string[];
}
