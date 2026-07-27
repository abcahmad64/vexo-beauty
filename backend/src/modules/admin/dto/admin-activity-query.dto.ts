import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import {
  trimOptionalString,
  toOptionalInteger,
} from '../../../core/utils/transformer.util';

const adminActivitySources = [
  'all',
  'orders',
  'payments',
  'refunds',
  'invoices',
  'notifications',
  'users',
] as const;

export class AdminActivityQueryDto {
  @IsOptional()
  @IsIn(adminActivitySources)
  source?: (typeof adminActivitySources)[number];

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
