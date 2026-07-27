import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

export class AdminSecurityEvaluateDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  ipAddress?: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(500)
  route!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(20)
  method!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  userAgent?: string;

  @IsOptional()
  @IsBoolean()
  createIncident?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
