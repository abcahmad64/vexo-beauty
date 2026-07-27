import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

const normalizeOptionalRoleName = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.replace(/\s+/g, '_').toUpperCase() : null;
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

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalRoleName)
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  description?: string | null;
}
