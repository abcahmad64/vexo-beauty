import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

export class AdminCreateSearchSynonymDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(120)
  term!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsArray()
  @ArrayMaxSize(50)
  synonyms!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminUpdateSearchSynonymDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  term?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  synonyms?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
