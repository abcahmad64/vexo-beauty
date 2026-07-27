import { DEFAULT_PAGINATION } from '../constants/core.constants';
import type {
  PaginatedResponse,
  PaginationMeta,
} from '../interfaces/paginated-response.interface';

export interface PaginationInput {
  readonly page?: number;
  readonly limit?: number;
}

export interface PrismaPagination {
  readonly skip: number;
  readonly take: number;
}

export function normalizePage(page?: number): number {
  if (!Number.isFinite(page) || !page || page < 1) {
    return DEFAULT_PAGINATION.PAGE;
  }

  return Math.trunc(page);
}

export function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit) || !limit || limit < 1) {
    return DEFAULT_PAGINATION.LIMIT;
  }

  return Math.min(Math.trunc(limit), DEFAULT_PAGINATION.MAX_LIMIT);
}

export function normalizeTotal(total: number): number {
  if (!Number.isFinite(total) || total < 0) {
    return 0;
  }

  return Math.trunc(total);
}

export function getPagination(input: PaginationInput): PrismaPagination {
  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPaginationMeta(
  total: number,
  input: PaginationInput,
): PaginationMeta {
  const page = normalizePage(input.page);
  const limit = normalizeLimit(input.limit);
  const normalizedTotal = normalizeTotal(total);
  const totalPages =
    normalizedTotal > 0 ? Math.ceil(normalizedTotal / limit) : 0;

  return {
    page,
    limit,
    total: normalizedTotal,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function buildPaginatedResponse<T>(
  items: readonly T[],
  total: number,
  input: PaginationInput,
): PaginatedResponse<T> {
  return {
    items,
    meta: buildPaginationMeta(total, input),
  };
}
