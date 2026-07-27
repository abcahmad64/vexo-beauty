import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminAiGuardrailAction, AdminAiSeverity } from './admin-query-ai.dto';

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

export class AdminCreateAiGuardrailDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  key!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  title!: string;

  @IsString()
  @Transform(trimRequiredString)
  pattern!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminAiSeverity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WARN', 'BLOCK'])
  action?: AdminAiGuardrailAction;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateAiGuardrailDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  key?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  pattern?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: AdminAiSeverity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['WARN', 'BLOCK'])
  action?: AdminAiGuardrailAction;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
