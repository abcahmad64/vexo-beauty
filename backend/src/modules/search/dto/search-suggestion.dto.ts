import { IsOptional, IsString, MaxLength } from 'class-validator';

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

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
};

export class SearchSuggestionDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  limit?: number;
}
