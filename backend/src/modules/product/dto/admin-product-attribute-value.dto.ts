import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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

export class AdminProductAttributeValueDto {
  @IsString()
  @Transform(trimOptionalString)
  attributeId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  attributeValueId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  valueText?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^-?\d+(\.\d{1,4})?$/)
  valueNumber?: string;

  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;

  @IsOptional()
  @IsObject()
  valueJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  unit?: string;
}
