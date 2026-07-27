import {
  IsBoolean,
  IsIn,
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

export type AdminSearchIndexName =
  'all' | 'catalog' | 'products' | 'categories' | 'brands' | 'content';

export class AdminRunSearchIndexDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['all', 'catalog', 'products', 'categories', 'brands', 'content'])
  indexName!: AdminSearchIndexName;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
