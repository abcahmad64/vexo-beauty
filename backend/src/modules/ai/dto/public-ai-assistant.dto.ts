import { Transform } from 'class-transformer';

import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);

  return normalized.length > 0 ? normalized : undefined;
}

export class PublicAiChatDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(2000)
  question?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(12)
  @IsIn(['fa', 'en', 'ar'])
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(1000)
  customerContext?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsUUID('4', { each: true })
  productIds?: string[];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(8)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(240)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(180)
  productIdentifier?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(3000)
  conversationContext?: string;
}

export class PublicAiSalesDto extends PublicAiChatDto {
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(200)
  salesGoal?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(200)
  audience?: string;
}

export class PublicAiConsultingDto extends PublicAiChatDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(120)
  skinType?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(120)
  hairType?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  concerns?: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trimOptionalString(value))
  @MaxLength(80)
  budgetHint?: string;
}
