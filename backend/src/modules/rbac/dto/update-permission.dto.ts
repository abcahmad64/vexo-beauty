import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const normalizeOptionalPermissionName = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.replace(/\s+/g, ':').toLowerCase() : null;
};

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

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalPermissionName)
  @Length(3, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string | null;
}
