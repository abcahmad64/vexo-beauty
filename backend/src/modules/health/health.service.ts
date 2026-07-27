import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import type { RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isAbsolute, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

import { PrismaService } from '../../core/prisma/prisma.service';
import {
  HEALTH_BUNNY_DEFAULT_STORAGE_HOST,
  HEALTH_DEFAULT_AI_MODEL,
  HEALTH_DEFAULT_OLLAMA_BASE_URL,
  HEALTH_DEFAULT_TIMEOUT_MS,
  HEALTH_DEPENDENCY_LABELS,
  HEALTH_DEPENDENCY_NAMES,
  HEALTH_SERVICE_NAME,
  HEALTH_STATUS,
} from './constants/health.constants';
import type {
  AiHealthConfig,
  BunnyStorageConfig,
  HealthAggregateResponse,
  HealthCheckResult,
  HealthDependencyName,
  HealthDetails,
  HealthLivenessResponse,
  HealthStatus,
  HealthVersionResponse,
  HttpRequestOptions,
  HttpResponseSummary,
  RedisConnectionConfig,
  RedisConnectionSource,
} from './types/health.types';

type StorageDriver = 'local' | 'bunny';

type StorageDriverResolution =
  | {
      readonly driver: StorageDriver;
      readonly rawValue: string | null;
    }
  | {
      readonly driver: 'unsupported';
      readonly rawValue: string;
    };

interface LocalStorageConfig {
  readonly root: string;
  readonly resolvedRoot: string;
  readonly publicBaseUrl: string;
  readonly serveEnabled: boolean;
}

interface DatabaseReadinessRow {
  readonly schemaName: string | null;
  readonly migrationsTable: string | null;
  readonly userTable: string | null;
}

interface DatabaseMigrationStateRow {
  readonly failedMigrationCount: number | string | bigint;
}

class DatabaseReadinessError extends Error {}

class StorageReadinessError extends Error {}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness(): HealthLivenessResponse {
    return {
      service: HEALTH_SERVICE_NAME,
      status: HEALTH_STATUS.UP,
      healthy: true,
      message: 'سرویس فعال است و پردازش اصلی برنامه در حال اجرا است.',
      timestamp: this.now(),
      uptimeSeconds: this.getUptimeSeconds(),
    };
  }

  getVersion(): HealthVersionResponse {
    return {
      service: HEALTH_SERVICE_NAME,
      status: HEALTH_STATUS.UP,
      healthy: true,
      message: 'اطلاعات نسخه سرویس با موفقیت دریافت شد.',
      version: this.getApplicationVersion(),
      environment: this.getEnvironment(),
      nodeVersion: process.version,
      uptimeSeconds: this.getUptimeSeconds(),
      timestamp: this.now(),
    };
  }

  async getReadiness(): Promise<HealthAggregateResponse> {
    const checks = await this.runDependencyChecks();

    return this.createAggregateResponse(
      checks,
      'وضعیت آمادگی سرویس برای دریافت ترافیک بررسی شد.',
    );
  }

  async getDependencyHealth(): Promise<HealthAggregateResponse> {
    const checks = await this.runDependencyChecks();

    return this.createAggregateResponse(
      checks,
      'وضعیت وابستگی‌های اصلی سرویس بررسی شد.',
    );
  }

  async getDatabaseHealth(): Promise<HealthCheckResult> {
    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.DATABASE,
      HEALTH_DEPENDENCY_LABELS.DATABASE,
      true,
      async () => {
        try {
          const readinessRows = await this.prisma.$queryRaw<
            DatabaseReadinessRow[]
          >`
            SELECT
              current_schema() AS "schemaName",
              to_regclass('_prisma_migrations')::text AS "migrationsTable",
              to_regclass('"User"')::text AS "userTable"
          `;

          const readiness = readinessRows[0];

          if (!readiness?.userTable) {
            throw new DatabaseReadinessError(
              'ساختار اصلی پایگاه داده هنوز آماده نیست.',
            );
          }

          const migrationsRequired = this.getBooleanConfig(
            'DATABASE_MIGRATIONS_REQUIRED',
            this.isProductionLikeEnvironment(),
          );

          if (migrationsRequired && !readiness.migrationsTable) {
            throw new DatabaseReadinessError(
              'جدول مهاجرت‌های Prisma در پایگاه داده آماده نیست.',
            );
          }

          let failedMigrationCount = 0;

          if (readiness.migrationsTable) {
            const migrationRows = await this.prisma.$queryRaw<
              DatabaseMigrationStateRow[]
            >`
              SELECT COUNT(*)::int AS "failedMigrationCount"
              FROM "_prisma_migrations"
              WHERE "finished_at" IS NULL
                AND "rolled_back_at" IS NULL
            `;

            failedMigrationCount = this.normalizeCount(
              migrationRows[0]?.failedMigrationCount,
            );

            if (failedMigrationCount > 0) {
              throw new DatabaseReadinessError(
                'یک یا چند مهاجرت Prisma ناقص یا ناموفق است.',
              );
            }
          }

          return {
            message:
              'اتصال PostgreSQL، ساختار اصلی و وضعیت مهاجرت‌ها سالم است.',
            details: {
              configured: Boolean(this.getFirstConfigValue(['DATABASE_URL'])),
              connection: this.sanitizeConnectionUrl(
                this.getFirstConfigValue(['DATABASE_URL']),
              ),
              schema: readiness.schemaName,
              schemaReady: true,
              migrationsRequired,
              migrationsTableReady: Boolean(readiness.migrationsTable),
              failedMigrationCount,
              connectionTimeoutMs: this.getNumberConfig(
                ['DATABASE_CONNECTION_TIMEOUT_MS'],
                10_000,
              ),
              statementTimeoutMs: this.getNumberConfig(
                ['DATABASE_STATEMENT_TIMEOUT_MS'],
                30_000,
              ),
              queryTimeoutMs: this.getNumberConfig(
                ['DATABASE_QUERY_TIMEOUT_MS'],
                30_000,
              ),
              poolMin: this.getNumberConfig(['DATABASE_POOL_MIN'], 0),
              poolMax: this.getNumberConfig(['DATABASE_POOL_MAX'], 10),
              applicationName:
                this.getFirstConfigValue(['DATABASE_APPLICATION_NAME']) ??
                'vexo-beauty-backend',
            },
          };
        } catch (error: unknown) {
          if (error instanceof DatabaseReadinessError) {
            throw error;
          }

          this.logger.warn(
            `Database readiness check failed (${this.extractErrorCode(error)}).`,
          );

          throw new DatabaseReadinessError(
            'اتصال یا پاسخ‌گویی پایگاه داده PostgreSQL آماده نیست.',
          );
        }
      },
    );
  }

  async getRedisHealth(): Promise<HealthCheckResult> {
    const critical = this.isRedisRequired();
    const redisConfig = this.resolveRedisConfig();

    if (!redisConfig) {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.REDIS,
        HEALTH_DEPENDENCY_LABELS.REDIS,
        critical ? HEALTH_STATUS.DOWN : HEALTH_STATUS.DEGRADED,
        critical,
        'تنظیمات اتصال به Redis پیدا نشد.',
        0,
        {
          configured: false,
          required: critical,
        },
      );
    }

    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.REDIS,
      HEALTH_DEPENDENCY_LABELS.REDIS,
      critical,
      async () => {
        await this.pingRedis(redisConfig, this.getTimeoutMs());

        return {
          message: 'اتصال و احراز هویت Redis با پاسخ PONG تأیید شد.',
          details: this.createRedisHealthDetails(redisConfig, critical),
        };
      },
    );
  }

  async getQueueHealth(): Promise<HealthCheckResult> {
    const enabled = this.getBooleanConfig('QUEUE_ENABLED', true);
    const critical =
      enabled && this.getBooleanConfig('QUEUE_REDIS_REQUIRED', true);

    if (!enabled) {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.QUEUE,
        HEALTH_DEPENDENCY_LABELS.QUEUE,
        HEALTH_STATUS.UP,
        false,
        'سیستم صف به‌صورت آگاهانه غیرفعال است.',
        0,
        {
          configured: false,
          enabled: false,
          required: false,
        },
      );
    }

    const redisConfig = this.resolveQueueRedisConfig();

    if (!redisConfig) {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.QUEUE,
        HEALTH_DEPENDENCY_LABELS.QUEUE,
        critical ? HEALTH_STATUS.DOWN : HEALTH_STATUS.DEGRADED,
        critical,
        'تنظیمات Redis مربوط به صف معتبر نیست.',
        0,
        {
          configured: false,
          enabled: true,
          required: critical,
        },
      );
    }

    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.QUEUE,
      HEALTH_DEPENDENCY_LABELS.QUEUE,
      critical,
      async () => {
        await this.pingRedis(redisConfig, this.getTimeoutMs());

        return {
          message: 'اتصال Redis مورد استفاده BullMQ با پاسخ PONG تأیید شد.',
          details: {
            ...this.createRedisHealthDetails(redisConfig, critical),
            enabled: true,
            queuePrefix:
              this.getFirstConfigValue(['QUEUE_PREFIX']) ?? 'vexo:queue',
          },
        };
      },
    );
  }

  async getStorageHealth(): Promise<HealthCheckResult> {
    const critical = this.getBooleanConfig('HEALTH_REQUIRE_STORAGE', false);
    const storageDriver = this.resolveStorageDriver();

    if (storageDriver.driver === 'unsupported') {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.STORAGE,
        HEALTH_DEPENDENCY_LABELS.STORAGE,
        critical ? HEALTH_STATUS.DOWN : HEALTH_STATUS.DEGRADED,
        critical,
        'مقدار MEDIA_STORAGE_DRIVER معتبر نیست. مقدار مجاز فقط local یا bunny است.',
        0,
        {
          configured: false,
          required: critical,
          driver: storageDriver.rawValue,
        },
      );
    }

    if (storageDriver.driver === 'local') {
      return this.getLocalStorageHealth(critical);
    }

    return this.getBunnyStorageHealth(critical);
  }

  async getAiHealth(): Promise<HealthCheckResult> {
    const critical = this.getBooleanConfig('HEALTH_REQUIRE_AI', false);
    const enabled = this.getBooleanConfig('AI_ENABLED', true);

    if (!enabled) {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.AI,
        HEALTH_DEPENDENCY_LABELS.AI,
        HEALTH_STATUS.UP,
        false,
        'سرویس هوش مصنوعی به‌صورت آگاهانه غیرفعال است.',
        0,
        {
          configured: false,
          enabled: false,
          required: false,
          provider: 'Ollama',
        },
      );
    }

    const aiConfig = this.resolveAiHealthConfig();

    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.AI,
      HEALTH_DEPENDENCY_LABELS.AI,
      critical,
      async () => {
        const targetUrl = `${this.trimTrailingSlash(aiConfig.baseUrl)}/api/tags`;

        const response = await this.requestHttpEndpoint(targetUrl, {
          method: 'GET',
          timeoutMs: this.getTimeoutMs(),
        });

        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(
            `سرویس Ollama با کد وضعیت ${response.statusCode} پاسخ داد.`,
          );
        }

        return {
          message: 'اتصال به سرویس هوش مصنوعی Ollama سالم است.',
          details: {
            configured: aiConfig.configured,
            required: critical,
            provider: 'Ollama',
            model: aiConfig.model,
            baseUrl: this.sanitizePublicUrl(aiConfig.baseUrl),
            statusCode: response.statusCode,
          },
        };
      },
    );
  }

  private async getLocalStorageHealth(
    critical: boolean,
  ): Promise<HealthCheckResult> {
    const localConfig = this.resolveLocalStorageConfig();

    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.STORAGE,
      HEALTH_DEPENDENCY_LABELS.STORAGE,
      critical,
      async () => {
        try {
          await this.verifyLocalStorage(localConfig.resolvedRoot);
        } catch (error: unknown) {
          this.logger.warn(
            `Local storage readiness check failed (${this.extractErrorCode(error)}).`,
          );

          throw new StorageReadinessError(
            'فضای ذخیره‌سازی محلی قابل خواندن یا نوشتن نیست.',
          );
        }

        return {
          message:
            'فضای ذخیره‌سازی محلی سالم است و امکان خواندن و نوشتن وجود دارد.',
          details: {
            configured: true,
            required: critical,
            provider: 'Local Storage',
            driver: 'local',
            publicBaseUrl: localConfig.publicBaseUrl,
            serveEnabled: localConfig.serveEnabled,
            readable: true,
            writable: true,
          },
        };
      },
    );
  }

  private async getBunnyStorageHealth(
    critical: boolean,
  ): Promise<HealthCheckResult> {
    const storageConfig = this.resolveBunnyStorageConfig();

    if (!storageConfig) {
      return this.createManualCheckResult(
        HEALTH_DEPENDENCY_NAMES.STORAGE,
        HEALTH_DEPENDENCY_LABELS.STORAGE,
        critical ? HEALTH_STATUS.DOWN : HEALTH_STATUS.DEGRADED,
        critical,
        'تنظیمات Bunny Storage کامل یا واقعی نیست.',
        0,
        {
          configured: false,
          required: critical,
          provider: 'Bunny Storage',
          driver: 'bunny',
        },
      );
    }

    return this.measureCheck(
      HEALTH_DEPENDENCY_NAMES.STORAGE,
      HEALTH_DEPENDENCY_LABELS.STORAGE,
      critical,
      async () => {
        try {
          const targetUrl = `${storageConfig.baseUrl}/${encodeURIComponent(
            storageConfig.zoneName,
          )}/`;

          const response = await this.requestHttpEndpoint(targetUrl, {
            method: 'GET',
            timeoutMs: this.getTimeoutMs(),
            headers: {
              AccessKey: storageConfig.accessKey,
            },
          });

          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new StorageReadinessError(
              'Bunny Storage پاسخ سالمی ارائه نکرد.',
            );
          }

          return {
            message: 'اتصال به Bunny Storage سالم است.',
            details: {
              configured: true,
              required: critical,
              provider: 'Bunny Storage',
              driver: 'bunny',
              endpoint: storageConfig.displayUrl,
              cdnUrl: storageConfig.cdnUrl,
              statusCode: response.statusCode,
            },
          };
        } catch (error: unknown) {
          if (error instanceof StorageReadinessError) {
            throw error;
          }

          this.logger.warn(
            `Bunny storage readiness check failed (${this.extractErrorCode(error)}).`,
          );

          throw new StorageReadinessError(
            'اتصال یا پاسخ‌گویی Bunny Storage آماده نیست.',
          );
        }
      },
    );
  }

  private async runDependencyChecks(): Promise<readonly HealthCheckResult[]> {
    return Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
      this.getQueueHealth(),
      this.getStorageHealth(),
      this.getAiHealth(),
    ]);
  }

  private createAggregateResponse(
    checks: readonly HealthCheckResult[],
    successMessage: string,
  ): HealthAggregateResponse {
    const hasCriticalFailure = checks.some(
      (check) => check.critical && check.status !== HEALTH_STATUS.UP,
    );

    const hasAnyProblem = checks.some(
      (check) => check.status !== HEALTH_STATUS.UP,
    );

    const status = this.resolveAggregateStatus(
      hasCriticalFailure,
      hasAnyProblem,
    );

    return {
      service: HEALTH_SERVICE_NAME,
      status,
      healthy: !hasCriticalFailure,
      message: hasCriticalFailure
        ? 'سرویس برای دریافت ترافیک آماده نیست.'
        : successMessage,
      timestamp: this.now(),
      uptimeSeconds: this.getUptimeSeconds(),
      checks,
    };
  }

  private resolveAggregateStatus(
    hasCriticalFailure: boolean,
    hasAnyProblem: boolean,
  ): HealthStatus {
    if (hasCriticalFailure) {
      return HEALTH_STATUS.DOWN;
    }

    if (hasAnyProblem) {
      return HEALTH_STATUS.DEGRADED;
    }

    return HEALTH_STATUS.UP;
  }

  private async measureCheck(
    name: HealthDependencyName,
    label: string,
    critical: boolean,
    operation: () => Promise<{
      readonly message: string;
      readonly details: HealthDetails;
    }>,
  ): Promise<HealthCheckResult> {
    const startedAt = performance.now();

    try {
      const result = await operation();
      const latencyMs = this.calculateLatencyMs(startedAt);

      return this.createManualCheckResult(
        name,
        label,
        HEALTH_STATUS.UP,
        critical,
        result.message,
        latencyMs,
        result.details,
      );
    } catch (error: unknown) {
      const latencyMs = this.calculateLatencyMs(startedAt);

      return this.createManualCheckResult(
        name,
        label,
        critical ? HEALTH_STATUS.DOWN : HEALTH_STATUS.DEGRADED,
        critical,
        this.extractErrorMessage(error),
        latencyMs,
        {
          required: critical,
        },
      );
    }
  }

  private createManualCheckResult(
    name: HealthDependencyName,
    label: string,
    status: HealthStatus,
    critical: boolean,
    message: string,
    latencyMs: number,
    details: HealthDetails,
  ): HealthCheckResult {
    return {
      name,
      label,
      status,
      critical,
      message,
      latencyMs,
      checkedAt: this.now(),
      details,
    };
  }

  private resolveStorageDriver(): StorageDriverResolution {
    const rawDriver = this.getFirstConfigValue(['MEDIA_STORAGE_DRIVER']);

    if (!rawDriver) {
      return {
        driver: 'local',
        rawValue: null,
      };
    }

    const normalizedDriver = rawDriver.trim().toLowerCase();

    if (normalizedDriver === 'local' || normalizedDriver === 'bunny') {
      return {
        driver: normalizedDriver,
        rawValue: rawDriver,
      };
    }

    return {
      driver: 'unsupported',
      rawValue: rawDriver,
    };
  }

  private resolveLocalStorageConfig(): LocalStorageConfig {
    const root =
      this.getFirstConfigValue(['MEDIA_LOCAL_ROOT']) ?? 'public/uploads';

    const publicBaseUrl =
      this.getFirstConfigValue(['MEDIA_PUBLIC_BASE_URL']) ?? '/uploads';

    return {
      root,
      resolvedRoot: isAbsolute(root) ? root : resolve(process.cwd(), root),
      publicBaseUrl,
      serveEnabled: this.getBooleanConfig('MEDIA_LOCAL_SERVE_ENABLED', true),
    };
  }

  private async verifyLocalStorage(resolvedRoot: string): Promise<void> {
    const healthDirectory = join(resolvedRoot, '.health');

    await mkdir(healthDirectory, {
      recursive: true,
    });

    await access(healthDirectory, fsConstants.R_OK | fsConstants.W_OK);

    const filePath = join(
      healthDirectory,
      `health-${process.pid}-${Date.now()}-${randomUUID()}.txt`,
    );

    const expectedContent = `vexo-health-${this.now()}`;
    let fileCreated = false;

    try {
      await writeFile(filePath, expectedContent, {
        encoding: 'utf8',
      });

      fileCreated = true;

      const actualContent = await readFile(filePath, {
        encoding: 'utf8',
      });

      if (actualContent !== expectedContent) {
        throw new Error(
          'خواندن فایل تست فضای ذخیره‌سازی محلی با مقدار نوشته‌شده یکسان نیست.',
        );
      }
    } finally {
      if (fileCreated) {
        await unlink(filePath).catch(() => undefined);
      }
    }
  }

  private resolveRedisConfig(): RedisConnectionConfig | null {
    const redisUrl = this.getFirstConfigValue(['REDIS_URL']);

    if (redisUrl) {
      return this.parseRedisUrl(redisUrl, 'REDIS_URL');
    }

    return this.resolveRedisParts({
      hostKeys: ['REDIS_HOST'],
      portKeys: ['REDIS_PORT'],
      usernameKeys: ['REDIS_USERNAME'],
      passwordKeys: ['REDIS_PASSWORD'],
      dbKeys: ['REDIS_DB'],
      tlsKey: 'REDIS_TLS',
      source: 'REDIS_HOST',
    });
  }

  private resolveQueueRedisConfig(): RedisConnectionConfig | null {
    const queueRedisUrl = this.getFirstConfigValue([
      'QUEUE_REDIS_URL',
      'REDIS_URL',
    ]);

    if (queueRedisUrl) {
      return this.parseRedisUrl(
        queueRedisUrl,
        this.getFirstConfigValue(['QUEUE_REDIS_URL'])
          ? 'QUEUE_REDIS_URL'
          : 'REDIS_URL',
      );
    }

    return this.resolveRedisParts({
      hostKeys: ['QUEUE_REDIS_HOST', 'REDIS_HOST'],
      portKeys: ['QUEUE_REDIS_PORT', 'REDIS_PORT'],
      usernameKeys: ['QUEUE_REDIS_USERNAME', 'REDIS_USERNAME'],
      passwordKeys: ['QUEUE_REDIS_PASSWORD', 'REDIS_PASSWORD'],
      dbKeys: ['QUEUE_REDIS_DB', 'REDIS_DB'],
      tlsKey: this.getFirstConfigValue(['QUEUE_REDIS_TLS'])
        ? 'QUEUE_REDIS_TLS'
        : 'REDIS_TLS',
      source: this.getFirstConfigValue(['QUEUE_REDIS_HOST'])
        ? 'QUEUE_REDIS_HOST'
        : 'REDIS_HOST',
      fallbackHost: '127.0.0.1',
      fallbackPort: 6379,
    });
  }

  private resolveRedisParts(options: {
    readonly hostKeys: readonly string[];
    readonly portKeys: readonly string[];
    readonly usernameKeys: readonly string[];
    readonly passwordKeys: readonly string[];
    readonly dbKeys: readonly string[];
    readonly tlsKey: string;
    readonly source: RedisConnectionSource;
    readonly fallbackHost?: string;
    readonly fallbackPort?: number;
  }): RedisConnectionConfig | null {
    const host =
      this.getFirstConfigValue(options.hostKeys) ?? options.fallbackHost;
    const port = this.getIntegerConfig(
      options.portKeys,
      options.fallbackPort,
      1,
      65_535,
    );

    if (!host || port === null) {
      return null;
    }

    const tls = this.getBooleanConfig(options.tlsKey, false);
    const db = this.getIntegerConfig(options.dbKeys, 0, 0, 15) ?? 0;

    return {
      host,
      port,
      username: this.getFirstConfigValue(options.usernameKeys) ?? null,
      password: this.getFirstConfigValue(options.passwordKeys) ?? null,
      db,
      tls,
      source: options.source,
      displayAddress: `${tls ? 'rediss' : 'redis'}://${host}:${port}/${db}`,
    };
  }

  private parseRedisUrl(
    rawUrl: string,
    source: RedisConnectionSource,
  ): RedisConnectionConfig | null {
    try {
      const parsedUrl = new URL(rawUrl);

      if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
        return null;
      }

      const tls = parsedUrl.protocol === 'rediss:';
      const port = parsedUrl.port ? Number(parsedUrl.port) : tls ? 6380 : 6379;
      const db = this.parseRedisDatabase(parsedUrl.pathname);

      if (
        !parsedUrl.hostname ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65_535 ||
        db === null
      ) {
        return null;
      }

      return {
        host: parsedUrl.hostname,
        port,
        username: this.decodeUrlComponent(parsedUrl.username),
        password: this.decodeUrlComponent(parsedUrl.password),
        db,
        tls,
        source,
        displayAddress: `${tls ? 'rediss' : 'redis'}://${parsedUrl.hostname}:${port}/${db}`,
      };
    } catch {
      return null;
    }
  }

  private parseRedisDatabase(pathname: string): number | null {
    const normalized = pathname.replace(/^\/+/, '').trim();

    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);

    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 15
      ? parsed
      : null;
  }

  private decodeUrlComponent(value: string): string | null {
    if (!value) {
      return null;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  private resolveBunnyStorageConfig(): BunnyStorageConfig | null {
    const zoneName = this.getFirstConfigValue([
      'BUNNY_STORAGE_ZONE_NAME',
      'BUNNY_STORAGE_ZONE',
      'BUNNY_ZONE_NAME',
    ]);

    const accessKey = this.getFirstConfigValue([
      'BUNNY_STORAGE_ACCESS_KEY',
      'BUNNY_STORAGE_API_KEY',
      'BUNNY_ACCESS_KEY',
      'BUNNY_API_KEY',
    ]);

    if (
      !zoneName ||
      !accessKey ||
      this.isPlaceholderConfigValue(zoneName) ||
      this.isPlaceholderConfigValue(accessKey)
    ) {
      return null;
    }

    const endpoint = this.getFirstConfigValue([
      'BUNNY_STORAGE_ENDPOINT',
      'BUNNY_STORAGE_BASE_URL',
    ]);

    const region = this.getFirstConfigValue(['BUNNY_STORAGE_REGION']);

    const storageHost = region
      ? `${region}.${HEALTH_BUNNY_DEFAULT_STORAGE_HOST}`
      : HEALTH_BUNNY_DEFAULT_STORAGE_HOST;

    const baseUrl = endpoint
      ? this.normalizeHttpBaseUrl(endpoint)
      : `https://${storageHost}`;

    const cdnUrl = this.getFirstConfigValue([
      'BUNNY_CDN_URL',
      'NEXT_PUBLIC_BUNNY_CDN_URL',
      'BUNNY_PULL_ZONE_URL',
    ]);

    return {
      zoneName,
      accessKey,
      baseUrl,
      displayUrl: this.sanitizePublicUrl(baseUrl),
      cdnUrl:
        cdnUrl && !this.isPlaceholderConfigValue(cdnUrl)
          ? this.sanitizePublicUrl(cdnUrl)
          : null,
    };
  }

  private resolveAiHealthConfig(): AiHealthConfig {
    const configuredBaseUrl = this.getFirstConfigValue([
      'AI_OLLAMA_BASE_URL',
      'OLLAMA_BASE_URL',
      'OLLAMA_HOST',
    ]);

    const model =
      this.getFirstConfigValue([
        'AI_OLLAMA_DEFAULT_MODEL',
        'OLLAMA_MODEL',
        'AI_DEFAULT_MODEL',
        'AI_MODEL',
      ]) ?? HEALTH_DEFAULT_AI_MODEL;

    return {
      baseUrl: configuredBaseUrl ?? HEALTH_DEFAULT_OLLAMA_BASE_URL,
      model,
      configured: Boolean(configuredBaseUrl),
    };
  }

  private async pingRedis(
    config: RedisConnectionConfig,
    timeoutMs: number,
  ): Promise<void> {
    const options: RedisOptions = {
      host: config.host,
      port: config.port,
      username: config.username ?? undefined,
      password: config.password ?? undefined,
      db: config.db,
      tls: config.tls ? {} : undefined,
      lazyConnect: true,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: timeoutMs,
      commandTimeout: timeoutMs,
      maxRetriesPerRequest: 0,
      retryStrategy: (): null => null,
    };

    const client = new Redis(options);

    client.on('error', () => undefined);

    try {
      await client.connect();

      const response = await client.ping();

      if (response !== 'PONG') {
        throw new Error('Redis پاسخ معتبر PONG برنگرداند.');
      }
    } finally {
      try {
        if (client.status === 'ready') {
          await client.quit();
        } else {
          client.disconnect();
        }
      } catch {
        client.disconnect();
      }
    }
  }

  private createRedisHealthDetails(
    config: RedisConnectionConfig,
    critical: boolean,
  ): HealthDetails {
    return {
      configured: true,
      required: critical,
      host: config.host,
      port: config.port,
      db: config.db,
      tls: config.tls,
      authenticated: Boolean(config.username || config.password),
      source: config.source,
      address: config.displayAddress,
      command: 'PING',
    };
  }

  private isRedisRequired(): boolean {
    const rateLimitUsesRedis =
      (this.getFirstConfigValue(['RATE_LIMIT_STORAGE_DRIVER']) ?? 'memory') ===
      'redis';

    return (
      this.getBooleanConfig('HEALTH_REQUIRE_REDIS', false) ||
      this.getBooleanConfig('REDIS_REQUIRED', false) ||
      this.getBooleanConfig('CACHE_REDIS_REQUIRED', false) ||
      (rateLimitUsesRedis &&
        this.getBooleanConfig('RATE_LIMIT_REDIS_REQUIRED', false))
    );
  }

  private getIntegerConfig(
    keys: readonly string[],
    fallback: number | undefined,
    min: number,
    max: number,
  ): number | null {
    const configuredValue = this.getFirstConfigValue(keys);

    if (!configuredValue) {
      return fallback ?? null;
    }

    const parsed = Number(configuredValue);

    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      return null;
    }

    return parsed;
  }

  private async requestHttpEndpoint(
    targetUrl: string,
    options: HttpRequestOptions,
  ): Promise<HttpResponseSummary> {
    const url = new URL(targetUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('پروتکل آدرس HTTP معتبر نیست.');
    }

    const requestOptions: RequestOptions = {
      method: options.method,
      headers: options.headers,
    };

    const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

    return new Promise<HttpResponseSummary>((resolvePromise, rejectPromise) => {
      const request = requestFn(url, requestOptions, (response) => {
        let bodyPreview = '';

        response.setEncoding('utf8');

        response.on('data', (chunk: string) => {
          if (bodyPreview.length < 512) {
            bodyPreview += chunk.slice(0, 512 - bodyPreview.length);
          }
        });

        response.once('end', () => {
          resolvePromise({
            statusCode: response.statusCode ?? 0,
            bodyPreview,
          });
        });
      });

      request.setTimeout(options.timeoutMs, () => {
        request.destroy(
          new Error(
            `مهلت دریافت پاسخ از ${this.sanitizePublicUrl(
              targetUrl,
            )} پس از ${options.timeoutMs} میلی‌ثانیه پایان یافت.`,
          ),
        );
      });

      request.once('error', (error: Error) => {
        rejectPromise(error);
      });

      request.end();
    });
  }

  private getFirstConfigValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key);

      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private getNumberConfig(
    keys: readonly string[],
    defaultValue: number,
  ): number {
    for (const key of keys) {
      const value = this.configService.get<string | number>(key);

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return defaultValue;
  }

  private isProductionLikeEnvironment(): boolean {
    const environment = this.getEnvironment().toLowerCase();

    return environment === 'production' || environment === 'staging';
  }

  private getBooleanConfig(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);

    if (typeof value !== 'string') {
      return defaultValue;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return defaultValue;
  }

  private getTimeoutMs(): number {
    const configuredValue = this.configService.get<string>('HEALTH_TIMEOUT_MS');

    if (!configuredValue) {
      return HEALTH_DEFAULT_TIMEOUT_MS;
    }

    const parsedValue = Number(configuredValue);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      return HEALTH_DEFAULT_TIMEOUT_MS;
    }

    return parsedValue;
  }

  private getApplicationVersion(): string {
    return (
      this.getFirstConfigValue(['APP_VERSION', 'npm_package_version']) ??
      '0.0.0'
    );
  }

  private getEnvironment(): string {
    return this.getFirstConfigValue(['NODE_ENV']) ?? 'development';
  }

  private getUptimeSeconds(): number {
    return Math.floor(process.uptime());
  }

  private calculateLatencyMs(startedAt: number): number {
    return Math.round((performance.now() - startedAt) * 100) / 100;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private normalizeCount(value: unknown): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
  }

  private extractErrorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return 'unknown';
    }

    const code = (error as { readonly code?: unknown }).code;

    return typeof code === 'string' && code.trim() ? code.trim() : 'unknown';
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { readonly message?: unknown }).message;

      if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim();
      }
    }

    return 'خطای نامشخص هنگام بررسی سلامت سرویس رخ داد.';
  }

  private sanitizeConnectionUrl(rawUrl: string | undefined): string | null {
    if (!rawUrl) {
      return null;
    }

    try {
      const parsedUrl = new URL(rawUrl);

      if (parsedUrl.username) {
        parsedUrl.username = '***';
      }

      if (parsedUrl.password) {
        parsedUrl.password = '***';
      }

      return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
    } catch {
      return 'آدرس اتصال نامعتبر است.';
    }
  }

  private sanitizePublicUrl(rawUrl: string): string {
    try {
      const parsedUrl = new URL(rawUrl);

      if (parsedUrl.username) {
        parsedUrl.username = '***';
      }

      if (parsedUrl.password) {
        parsedUrl.password = '***';
      }

      return this.trimTrailingSlash(parsedUrl.toString());
    } catch {
      return rawUrl;
    }
  }

  private normalizeHttpBaseUrl(value: string): string {
    const normalizedValue = this.trimTrailingSlash(value.trim());

    if (
      normalizedValue.toLowerCase().startsWith('http://') ||
      normalizedValue.toLowerCase().startsWith('https://')
    ) {
      return normalizedValue;
    }

    return `https://${normalizedValue}`;
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/u, '');
  }

  private isPlaceholderConfigValue(value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue.length === 0 ||
      normalizedValue.includes('your-') ||
      normalizedValue.includes('placeholder') ||
      normalizedValue.includes('example') ||
      normalizedValue === 'change_me' ||
      normalizedValue === 'changeme' ||
      normalizedValue === 'todo'
    );
  }
}
