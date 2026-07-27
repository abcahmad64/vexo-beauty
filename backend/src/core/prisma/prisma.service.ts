import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';

import { Prisma, PrismaClient } from '../../generated/prisma';
import { DEFAULT_PAGINATION } from '../constants/core.constants';

type ConfigPrimitive = string | number | boolean;

interface NumberReadOptions {
  readonly min?: number;
  readonly max?: number;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;
  private disconnectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = readString(
      configService,
      ['database.url', 'DATABASE_URL'],
      process.env.DATABASE_URL,
    );

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to initialize Prisma Client.');
    }

    const logQueries = readBoolean(
      configService,
      ['database.logQueries', 'DATABASE_LOG_QUERIES'],
      false,
    );

    const transactionTimeoutMs = readNumber(
      configService,
      ['database.transactionTimeoutMs', 'DATABASE_TRANSACTION_TIMEOUT_MS'],
      15_000,
      {
        min: 1_000,
        max: 300_000,
      },
    );

    const maxWaitMs = readNumber(
      configService,
      ['database.maxWaitMs', 'DATABASE_MAX_WAIT_MS'],
      5_000,
      {
        min: 100,
        max: 60_000,
      },
    );

    const connectionTimeoutMs = readNumber(
      configService,
      ['database.connectionTimeoutMs', 'DATABASE_CONNECTION_TIMEOUT_MS'],
      10_000,
      {
        min: 1_000,
        max: 60_000,
      },
    );

    const statementTimeoutMs = readNumber(
      configService,
      ['database.statementTimeoutMs', 'DATABASE_STATEMENT_TIMEOUT_MS'],
      30_000,
      {
        min: 1_000,
        max: 300_000,
      },
    );

    const queryTimeoutMs = readNumber(
      configService,
      ['database.queryTimeoutMs', 'DATABASE_QUERY_TIMEOUT_MS'],
      30_000,
      {
        min: 1_000,
        max: 300_000,
      },
    );

    const idleTransactionTimeoutMs = readNumber(
      configService,
      [
        'database.idleTransactionTimeoutMs',
        'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS',
      ],
      60_000,
      {
        min: 1_000,
        max: 900_000,
      },
    );

    const poolMin = readNumber(
      configService,
      ['database.poolMin', 'DATABASE_POOL_MIN'],
      0,
      {
        min: 0,
        max: 50,
      },
    );

    const poolMax = readNumber(
      configService,
      ['database.poolMax', 'DATABASE_POOL_MAX'],
      10,
      {
        min: 1,
        max: 100,
      },
    );

    if (poolMin > poolMax) {
      throw new Error(
        'DATABASE_POOL_MIN cannot be greater than DATABASE_POOL_MAX.',
      );
    }

    const poolIdleTimeoutMs = readNumber(
      configService,
      ['database.poolIdleTimeoutMs', 'DATABASE_POOL_IDLE_TIMEOUT_MS'],
      30_000,
      {
        min: 1_000,
        max: 300_000,
      },
    );

    const poolMaxLifetimeSeconds = readNumber(
      configService,
      ['database.poolMaxLifetimeSeconds', 'DATABASE_POOL_MAX_LIFETIME_SECONDS'],
      1_800,
      {
        min: 0,
        max: 86_400,
      },
    );

    const applicationName =
      readString(
        configService,
        ['database.applicationName', 'DATABASE_APPLICATION_NAME'],
        'vexo-beauty-backend',
      ) ?? 'vexo-beauty-backend';

    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      connectionTimeoutMillis: connectionTimeoutMs,
      statement_timeout: statementTimeoutMs,
      query_timeout: queryTimeoutMs,
      idle_in_transaction_session_timeout: idleTransactionTimeoutMs,
      max: poolMax,
      min: poolMin,
      idleTimeoutMillis: poolIdleTimeoutMs,
      maxLifetimeSeconds: poolMaxLifetimeSeconds,
      application_name: applicationName,
      keepAlive: true,
      allowExitOnIdle: false,
    };

    const adapterLogger = new Logger(PrismaService.name);
    const adapter = new PrismaPg(poolConfig, {
      onPoolError: (error) => {
        adapterLogger.error(
          `PostgreSQL pool error (${summarizeDatabaseError(error)}).`,
        );
      },
      onConnectionError: (error) => {
        adapterLogger.error(
          `PostgreSQL connection error (${summarizeDatabaseError(error)}).`,
        );
      },
    });

    super({
      adapter,
      log: resolvePrismaLogLevels(logQueries),
      transactionOptions: {
        maxWait: maxWaitMs,
        timeout: transactionTimeoutMs,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.connected = true;
    this.logger.log('Prisma database connection established.');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.disconnectPromise ??= this.$disconnect()
      .then(() => {
        this.logger.log('Prisma database connection closed.');
      })
      .finally(() => {
        this.connected = false;
      });

    await this.disconnectPromise;
  }

  async queryRawSafe<T = unknown>(query: Prisma.Sql): Promise<T> {
    return this.$queryRaw<T>(query);
  }

  async executeRawSafe(query: Prisma.Sql): Promise<number> {
    return this.$executeRaw(query);
  }

  buildPagination(
    page = DEFAULT_PAGINATION.PAGE,
    limit = DEFAULT_PAGINATION.LIMIT,
  ): {
    readonly skip: number;
    readonly take: number;
  } {
    const normalizedPage = normalizePositiveInteger(
      page,
      DEFAULT_PAGINATION.PAGE,
      {
        min: 1,
      },
    );

    const normalizedLimit = normalizePositiveInteger(
      limit,
      DEFAULT_PAGINATION.LIMIT,
      {
        min: 1,
        max: DEFAULT_PAGINATION.MAX_LIMIT,
      },
    );

    return {
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
    };
  }
}

function resolvePrismaLogLevels(logQueries: boolean): Prisma.LogLevel[] {
  if (logQueries) {
    return ['query', 'info', 'warn', 'error'];
  }

  return ['warn', 'error'];
}

function readString(
  configService: ConfigService,
  keys: readonly string[],
  fallback?: string,
): string | undefined {
  for (const key of keys) {
    const value = configService.get<ConfigPrimitive>(key);
    const normalizedValue = normalizeString(value);

    if (normalizedValue) {
      return normalizedValue;
    }

    const envValue = normalizeString(process.env[key]);

    if (envValue) {
      return envValue;
    }
  }

  return normalizeString(fallback);
}

function readNumber(
  configService: ConfigService,
  keys: readonly string[],
  fallback: number,
  options?: NumberReadOptions,
): number {
  for (const key of keys) {
    const parsedFromConfig = parseNumber(
      configService.get<ConfigPrimitive>(key),
      options,
    );

    if (parsedFromConfig !== null) {
      return parsedFromConfig;
    }

    const parsedFromEnv = parseNumber(process.env[key], options);

    if (parsedFromEnv !== null) {
      return parsedFromEnv;
    }
  }

  return parseNumber(fallback, options) ?? fallback;
}

function readBoolean(
  configService: ConfigService,
  keys: readonly string[],
  fallback: boolean,
): boolean {
  for (const key of keys) {
    const parsedFromConfig = parseBoolean(
      configService.get<ConfigPrimitive>(key),
    );

    if (parsedFromConfig !== null) {
      return parsedFromConfig;
    }

    const parsedFromEnv = parseBoolean(process.env[key]);

    if (parsedFromEnv !== null) {
      return parsedFromEnv;
    }
  }

  return fallback;
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  options?: NumberReadOptions,
): number {
  return parseNumber(value, options) ?? fallback;
}

function parseNumber(
  value: unknown,
  options?: NumberReadOptions,
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value.trim());

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalizedValue = Math.trunc(parsed);

  if (options?.min !== undefined && normalizedValue < options.min) {
    return null;
  }

  if (options?.max !== undefined && normalizedValue > options.max) {
    return null;
  }

  return normalizedValue;
}

function parseBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function summarizeDatabaseError(error: Error): string {
  const code =
    typeof (error as Error & { readonly code?: unknown }).code === 'string'
      ? (error as Error & { readonly code: string }).code
      : 'unknown';

  return `${error.name || 'Error'}; code=${code}`;
}
