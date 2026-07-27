import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

export class AiProductCompareDto {
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  @IsString({
    each: true,
  })
  productIds!: string[];

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Length(2, 1000)
  question?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  customerProfile?: string;
}
