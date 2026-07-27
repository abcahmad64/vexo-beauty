import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const normalizePermissionName = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/\s+/g, ':').toLowerCase();
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

export class CreatePermissionDto {
  @IsString()
  @Transform(normalizePermissionName)
  @Length(3, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string;
}
