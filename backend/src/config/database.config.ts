import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  logQueries: boolean;
  transactionTimeoutMs: number;
  maxWaitMs: number;
  statementTimeoutMs: number;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL || '',
  logQueries: toBoolean(process.env.DATABASE_LOG_QUERIES, false),
  transactionTimeoutMs: toNumber(
    process.env.DATABASE_TRANSACTION_TIMEOUT_MS,
    15_000,
  ),
  maxWaitMs: toNumber(process.env.DATABASE_MAX_WAIT_MS, 5_000),
  statementTimeoutMs: toNumber(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS,
    30_000,
  ),
}));
