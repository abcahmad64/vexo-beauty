import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DEFAULT_PAGINATION } from '../constants/core.constants';

export type SortOrder = 'asc' | 'desc';

const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

function toInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalizedValue =
    typeof value === 'string' ? normalizeDigits(value.trim()) : value;

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeSortOrder(value: unknown): SortOrder | undefined {
  const normalizedValue = normalizeOptionalString(value)?.toLowerCase();

  if (normalizedValue === 'asc' || normalizedValue === 'desc') {
    return normalizedValue;
  }

  return undefined;
}

export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => toInteger(value, DEFAULT_PAGINATION.PAGE))
  @IsInt()
  @Min(1)
  page?: number = DEFAULT_PAGINATION.PAGE;

  @IsOptional()
  @Transform(({ value }) => toInteger(value, DEFAULT_PAGINATION.LIMIT))
  @IsInt()
  @Min(1)
  @Max(DEFAULT_PAGINATION.MAX_LIMIT)
  limit?: number = DEFAULT_PAGINATION.LIMIT;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSortOrder(value))
  @IsIn(SORT_ORDERS)
  sortOrder?: SortOrder;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalString(value))
  @IsString()
  @MaxLength(200)
  q?: string;
}
