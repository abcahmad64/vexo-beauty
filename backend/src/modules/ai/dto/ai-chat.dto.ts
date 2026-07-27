import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStringArray = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
};

export class AiChatDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  conversationId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  externalId?: string;

  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 4000)
  message!: string;

  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({
    each: true,
  })
  productIds?: string[];

  @IsOptional()
  @IsObject()
  visitorContext?: Record<string, unknown>;
}
