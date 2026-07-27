import {
  IsArray,
  IsBoolean,
  IsIn,
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

export type AdminAiKnowledgeSourceType =
  'MANUAL' | 'CMS' | 'PRODUCT' | 'POLICY' | 'FAQ' | 'URL';

export class AdminCreateAiKnowledgeDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  key!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['MANUAL', 'CMS', 'PRODUCT', 'POLICY', 'FAQ', 'URL'])
  sourceType?: AdminAiKnowledgeSourceType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsString()
  @Transform(trimRequiredString)
  content!: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateAiKnowledgeDto {
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
  @IsIn(['MANUAL', 'CMS', 'PRODUCT', 'POLICY', 'FAQ', 'URL'])
  sourceType?: AdminAiKnowledgeSourceType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  content?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
