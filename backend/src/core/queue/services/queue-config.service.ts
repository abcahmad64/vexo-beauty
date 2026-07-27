import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions, JobsOptions } from 'bullmq';

import {
  QUEUE_DEFAULTS,
  QUEUE_ENV_KEYS,
  QUEUE_OPERATIONAL_HEALTH_DEFAULTS,
  QUEUE_OPERATIONAL_HEALTH_ENV_KEYS,
  QUEUE_REDIS_ENV_KEYS,
} from '../constants/queue.constants';
import type {
  QueueConfig,
  QueueOperationalHealthThresholds,
  QueueRedisConnectionConfig,
} from '../types/queue.types';

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class QueueConfigService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): QueueConfig {
    return {
      enabled: this.getBoolean([QUEUE_ENV_KEYS.ENABLED, 'queue.enabled'], true),
      redisRequired: this.getBoolean(
        [QUEUE_ENV_KEYS.REDIS_REQUIRED, 'queue.redisRequired'],
        true,
      ),
      prefix: this.getString(
        [QUEUE_ENV_KEYS.PREFIX, 'queue.prefix'],
        QUEUE_DEFAULTS.KEY_PREFIX,
      ),
      defaultAttempts: this.getNumber(
        [QUEUE_ENV_KEYS.DEFAULT_ATTEMPTS, 'queue.defaultAttempts'],
        QUEUE_DEFAULTS.DEFAULT_ATTEMPTS,
        {
          min: 1,
          max: 20,
        },
      ),
      defaultBackoffDelayMs: this.getNumber(
        [
          QUEUE_ENV_KEYS.DEFAULT_BACKOFF_DELAY_MS,
          'queue.defaultBackoffDelayMs',
        ],
        QUEUE_DEFAULTS.DEFAULT_BACKOFF_DELAY_MS,
        {
          min: 100,
          max: 3_600_000,
        },
      ),
      defaultTimeoutMs: this.getNumber(
        [QUEUE_ENV_KEYS.DEFAULT_TIMEOUT_MS, 'queue.defaultTimeoutMs'],
        QUEUE_DEFAULTS.DEFAULT_TIMEOUT_MS,
        {
          min: 1_000,
          max: 3_600_000,
        },
      ),
      removeOnCompleteCount: this.getNumber(
        [
          QUEUE_ENV_KEYS.REMOVE_ON_COMPLETE_COUNT,
          'queue.removeOnCompleteCount',
        ],
        QUEUE_DEFAULTS.REMOVE_ON_COMPLETE_COUNT,
        {
          min: 1,
          max: 100_000,
        },
      ),
      removeOnFailCount: this.getNumber(
        [QUEUE_ENV_KEYS.REMOVE_ON_FAIL_COUNT, 'queue.removeOnFailCount'],
        QUEUE_DEFAULTS.REMOVE_ON_FAIL_COUNT,
        {
          min: 1,
          max: 100_000,
        },
      ),
      workerConcurrency: this.getNumber(
        [QUEUE_ENV_KEYS.WORKER_CONCURRENCY, 'queue.workerConcurrency'],
        QUEUE_DEFAULTS.WORKER_CONCURRENCY,
        {
          min: 1,
          max: 100,
        },
      ),
      stalledIntervalMs: this.getNumber(
        [QUEUE_ENV_KEYS.STALLED_INTERVAL_MS, 'queue.stalledIntervalMs'],
        QUEUE_DEFAULTS.STALLED_INTERVAL_MS,
        {
          min: 5_000,
          max: 300_000,
        },
      ),
      maxStalledCount: this.getNumber(
        [QUEUE_ENV_KEYS.MAX_STALLED_COUNT, 'queue.maxStalledCount'],
        QUEUE_DEFAULTS.MAX_STALLED_COUNT,
        {
          min: 0,
          max: 10,
        },
      ),
      operationalHealth: this.getOperationalHealthConfig(),
    };
  }

  private getOperationalHealthConfig(): QueueOperationalHealthThresholds {
    const backlogWarningThreshold = this.getNumber(
      [
        QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.BACKLOG_WARNING_THRESHOLD,
        'queue.operationalHealth.backlogWarningThreshold',
      ],
      QUEUE_OPERATIONAL_HEALTH_DEFAULTS.BACKLOG_WARNING_THRESHOLD,
      {
        min: 1,
        max: 999_999,
      },
    );

    const failedWarningThreshold = this.getNumber(
      [
        QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.FAILED_WARNING_THRESHOLD,
        'SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD',
        'queue.operationalHealth.failedWarningThreshold',
      ],
      QUEUE_OPERATIONAL_HEALTH_DEFAULTS.FAILED_WARNING_THRESHOLD,
      {
        min: 1,
        max: 999_999,
      },
    );

    const delayedWarningThreshold = this.getNumber(
      [
        QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.DELAYED_WARNING_THRESHOLD,
        'queue.operationalHealth.delayedWarningThreshold',
      ],
      QUEUE_OPERATIONAL_HEALTH_DEFAULTS.DELAYED_WARNING_THRESHOLD,
      {
        min: 1,
        max: 999_999,
      },
    );

    const failureRateWarningPercent = this.getNumber(
      [
        QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.FAILURE_RATE_WARNING_PERCENT,
        'queue.operationalHealth.failureRateWarningPercent',
      ],
      QUEUE_OPERATIONAL_HEALTH_DEFAULTS.FAILURE_RATE_WARNING_PERCENT,
      {
        min: 1,
        max: 99,
      },
    );

    return {
      backlogWarningThreshold,
      backlogCriticalThreshold: this.normalizeCriticalThreshold(
        backlogWarningThreshold,
        this.getNumber(
          [
            QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.BACKLOG_CRITICAL_THRESHOLD,
            'queue.operationalHealth.backlogCriticalThreshold',
          ],
          QUEUE_OPERATIONAL_HEALTH_DEFAULTS.BACKLOG_CRITICAL_THRESHOLD,
          {
            min: 2,
            max: 1_000_000,
          },
        ),
        1_000_000,
      ),
      failedWarningThreshold,
      failedCriticalThreshold: this.normalizeCriticalThreshold(
        failedWarningThreshold,
        this.getNumber(
          [
            QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.FAILED_CRITICAL_THRESHOLD,
            'queue.operationalHealth.failedCriticalThreshold',
          ],
          QUEUE_OPERATIONAL_HEALTH_DEFAULTS.FAILED_CRITICAL_THRESHOLD,
          {
            min: 2,
            max: 1_000_000,
          },
        ),
        1_000_000,
      ),
      delayedWarningThreshold,
      delayedCriticalThreshold: this.normalizeCriticalThreshold(
        delayedWarningThreshold,
        this.getNumber(
          [
            QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.DELAYED_CRITICAL_THRESHOLD,
            'queue.operationalHealth.delayedCriticalThreshold',
          ],
          QUEUE_OPERATIONAL_HEALTH_DEFAULTS.DELAYED_CRITICAL_THRESHOLD,
          {
            min: 2,
            max: 1_000_000,
          },
        ),
        1_000_000,
      ),
      failureRateWarningPercent,
      failureRateCriticalPercent: this.normalizeCriticalThreshold(
        failureRateWarningPercent,
        this.getNumber(
          [
            QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.FAILURE_RATE_CRITICAL_PERCENT,
            'queue.operationalHealth.failureRateCriticalPercent',
          ],
          QUEUE_OPERATIONAL_HEALTH_DEFAULTS.FAILURE_RATE_CRITICAL_PERCENT,
          {
            min: 2,
            max: 100,
          },
        ),
        100,
      ),
      failureRateMinSample: this.getNumber(
        [
          QUEUE_OPERATIONAL_HEALTH_ENV_KEYS.FAILURE_RATE_MIN_SAMPLE,
          'queue.operationalHealth.failureRateMinSample',
        ],
        QUEUE_OPERATIONAL_HEALTH_DEFAULTS.FAILURE_RATE_MIN_SAMPLE,
        {
          min: 1,
          max: 1_000_000,
        },
      ),
    };
  }

  private normalizeCriticalThreshold(
    warningThreshold: number,
    criticalThreshold: number,
    max: number,
  ): number {
    return Math.min(max, Math.max(warningThreshold + 1, criticalThreshold));
  }

  getRedisConnection(): QueueRedisConnectionConfig {
    const url = this.getString(
      [QUEUE_REDIS_ENV_KEYS.URL, 'REDIS_URL', 'queue.redis.url'],
      '',
    );

    const password = this.getString(
      [QUEUE_REDIS_ENV_KEYS.PASSWORD, 'REDIS_PASSWORD', 'queue.redis.password'],
      '',
    );

    return {
      url: url.length > 0 ? url : undefined,
      host: this.getString(
        [QUEUE_REDIS_ENV_KEYS.HOST, 'REDIS_HOST', 'queue.redis.host'],
        '127.0.0.1',
      ),
      port: this.getNumber(
        [QUEUE_REDIS_ENV_KEYS.PORT, 'REDIS_PORT', 'queue.redis.port'],
        6379,
        {
          min: 1,
          max: 65_535,
        },
      ),
      db: this.getNumber(
        [QUEUE_REDIS_ENV_KEYS.DB, 'REDIS_DB', 'queue.redis.db'],
        0,
        {
          min: 0,
          max: 15,
        },
      ),
      password: password.length > 0 ? password : undefined,
      tls: this.getBoolean(
        [QUEUE_REDIS_ENV_KEYS.TLS, 'REDIS_TLS', 'queue.redis.tls'],
        false,
      ),
      connectTimeoutMs: this.getNumber(
        [
          QUEUE_REDIS_ENV_KEYS.CONNECT_TIMEOUT_MS,
          'REDIS_CONNECT_TIMEOUT_MS',
          'queue.redis.connectTimeoutMs',
        ],
        3_000,
        {
          min: 100,
          max: 60_000,
        },
      ),
      maxRetriesPerRequest: this.getNumber(
        [
          QUEUE_REDIS_ENV_KEYS.MAX_RETRIES,
          'REDIS_MAX_RETRIES',
          'queue.redis.maxRetries',
        ],
        3,
        {
          min: 0,
          max: 20,
        },
      ),
    };
  }

  createBullConnectionOptions(): ConnectionOptions {
    const redis = this.getRedisConnection();

    if (redis.url) {
      const options = this.tryCreateConnectionOptionsFromUrl(redis);

      if (options) {
        return options;
      }
    }

    return this.createConnectionOptionsFromParts(redis);
  }

  createDefaultJobOptions(): JobsOptions {
    const config = this.getConfig();

    return {
      attempts: config.defaultAttempts,
      backoff: {
        type: 'exponential',
        delay: config.defaultBackoffDelayMs,
      },
      removeOnComplete: {
        count: config.removeOnCompleteCount,
      },
      removeOnFail: {
        count: config.removeOnFailCount,
      },
    };
  }
  private createConnectionOptionsFromParts(
    redis: QueueRedisConnectionConfig,
  ): ConnectionOptions {
    const options: ConnectionOptions = {
      host: redis.host,
      port: redis.port,
      db: redis.db,
      connectTimeout: redis.connectTimeoutMs,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      lazyConnect: false,
    };

    if (redis.password) {
      options.password = redis.password;
    }

    if (redis.tls) {
      options.tls = {};
    }

    return options;
  }

  private tryCreateConnectionOptionsFromUrl(
    redis: QueueRedisConnectionConfig,
  ): ConnectionOptions | null {
    if (!redis.url) {
      return null;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(redis.url);
    } catch {
      return null;
    }

    const isTls = parsedUrl.protocol === 'rediss:' || redis.tls;
    const parsedPort = this.parsePort(parsedUrl.port, isTls ? 6380 : 6379);
    const parsedDb = this.parseDatabaseFromPath(parsedUrl.pathname, redis.db);
    const parsedPassword =
      parsedUrl.password.length > 0
        ? decodeURIComponent(parsedUrl.password)
        : redis.password;

    const options: ConnectionOptions = {
      host: parsedUrl.hostname || redis.host,
      port: parsedPort,
      db: parsedDb,
      connectTimeout: redis.connectTimeoutMs,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      lazyConnect: false,
    };

    if (parsedUrl.username.length > 0) {
      options.username = decodeURIComponent(parsedUrl.username);
    }

    if (parsedPassword) {
      options.password = parsedPassword;
    }

    if (isTls) {
      options.tls = {};
    }

    return options;
  }

  private parsePort(value: string, fallback: number): number {
    if (value.trim().length === 0) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
      return fallback;
    }

    return parsed;
  }

  private parseDatabaseFromPath(pathname: string, fallback: number): number {
    const normalizedPathname = pathname.replace(/^\/+/, '').trim();

    if (normalizedPathname.length === 0) {
      return fallback;
    }

    const parsed = Number(normalizedPathname);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 15) {
      return fallback;
    }

    return parsed;
  }

  private getString(keys: readonly string[], fallback: string): string {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);

      if (typeof value === 'string') {
        const normalizedValue = value.trim();

        if (normalizedValue.length > 0) {
          return normalizedValue;
        }
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }

    return fallback;
  }

  private getNumber(
    keys: readonly string[],
    fallback: number,
    options?: {
      readonly min?: number;
      readonly max?: number;
    },
  ): number {
    const value = this.getString(keys, '');

    if (value.length === 0) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    if (options?.min !== undefined && parsed < options.min) {
      return fallback;
    }

    if (options?.max !== undefined && parsed > options.max) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private getBoolean(keys: readonly string[], fallback: boolean): boolean {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'number') {
        return value === 1;
      }

      if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();

        if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
          return true;
        }

        if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
          return false;
        }
      }
    }

    return fallback;
  }
}
