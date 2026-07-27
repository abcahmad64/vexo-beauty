import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

interface RedisConnectionConfig {
  readonly enabled: boolean;
  readonly required: boolean;
  readonly url: string | null;
  readonly host: string;
  readonly port: number;
  readonly password: string | null;
  readonly db: number;
  readonly tls: boolean;
  readonly connectTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly maxRetries: number;
}

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class RedisManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisManagerService.name);

  private readonly config: RedisConnectionConfig;

  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.resolveRedisConfig();
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log(
        'کش Redis غیرفعال است و Cache از حافظه داخلی استفاده می‌کند.',
      );
      return;
    }

    this.client = this.createRedisClient();
    this.registerRedisListeners(this.client);

    try {
      await this.client.connect();

      this.logger.log(
        `اتصال Redis برای Cache Layer برقرار شد: ${this.getConnectionLabel()}`,
      );
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);

      this.logger.error(`اتصال Redis برای Cache Layer برقرار نشد: ${message}`);

      const failedClient = this.client;
      this.client = null;

      try {
        failedClient.disconnect();
      } catch {
        // Ignore disconnect errors after failed startup connection.
      }

      if (this.config.required) {
        throw error;
      }

      this.logger.warn('Redis اجباری نیست؛ Cache به حافظه داخلی fallback کرد.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }

  getClient(): Redis | null {
    if (!this.client) {
      return null;
    }

    if (this.client.status !== 'ready') {
      return null;
    }

    return this.client;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  isRequired(): boolean {
    return this.config.required;
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  getConnectionLabel(): string {
    if (this.config.url) {
      try {
        const parsedUrl = new URL(this.config.url);
        const port =
          parsedUrl.port ||
          (parsedUrl.protocol === 'rediss:' ? '6380' : '6379');

        return `${parsedUrl.protocol}//${parsedUrl.hostname}:${port}`;
      } catch {
        return 'REDIS_URL نامعتبر';
      }
    }

    return `${this.config.tls ? 'rediss' : 'redis'}://${this.config.host}:${this.config.port}`;
  }

  private createRedisClient(): Redis {
    const options: RedisOptions = {
      lazyConnect: true,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: this.config.maxRetries,
      connectTimeout: this.config.connectTimeoutMs,
      commandTimeout: this.config.commandTimeoutMs,
      db: this.config.db,
      password: this.config.password ?? undefined,
      tls: this.config.tls ? {} : undefined,
      retryStrategy: (attempt: number): number | null => {
        if (attempt > this.config.maxRetries) {
          return null;
        }

        return Math.min(attempt * 250, 3_000);
      },
    };

    if (this.config.url) {
      return new Redis(this.config.url, options);
    }

    return new Redis({
      ...options,
      host: this.config.host,
      port: this.config.port,
    });
  }

  private registerRedisListeners(client: Redis): void {
    client.on('ready', () => {
      this.logger.log(`Redis آماده است: ${this.getConnectionLabel()}`);
    });

    client.on('error', (error: Error) => {
      this.logger.error(`خطای Redis Cache: ${error.message}`);
    });

    client.on('close', () => {
      this.logger.warn('اتصال Redis Cache بسته شد.');
    });

    client.on('end', () => {
      this.logger.warn('اتصال Redis Cache پایان یافت.');
    });

    client.on('reconnecting', () => {
      this.logger.warn('Redis Cache در حال اتصال مجدد است.');
    });
  }

  private resolveRedisConfig(): RedisConnectionConfig {
    const redisUrl =
      this.getFirstConfigValue(['REDIS_URL', 'redis.url', 'cache.redis.url']) ??
      null;

    const required = this.getBooleanConfig(
      [
        'CACHE_REDIS_REQUIRED',
        'REDIS_REQUIRED',
        'redis.required',
        'cache.redis.required',
      ],
      false,
    );

    const explicitEnabled = this.getOptionalBooleanConfig([
      'CACHE_REDIS_ENABLED',
      'REDIS_ENABLED',
      'redis.enabled',
      'cache.redis.enabled',
    ]);

    const enabled = required || (explicitEnabled ?? Boolean(redisUrl));

    const host =
      this.getFirstConfigValue([
        'REDIS_HOST',
        'redis.host',
        'cache.redis.host',
      ]) ?? 'localhost';

    const port = this.getNumberConfig(
      ['REDIS_PORT', 'redis.port', 'cache.redis.port'],
      6379,
      {
        min: 1,
        max: 65_535,
      },
    );

    const password =
      this.getFirstConfigValue([
        'REDIS_PASSWORD',
        'redis.password',
        'cache.redis.password',
      ]) ?? null;

    const tls = this.getBooleanConfig(
      ['REDIS_TLS', 'redis.tls', 'cache.redis.tls'],
      redisUrl?.startsWith('rediss://') ?? false,
    );

    const db = this.getNumberConfig(
      ['CACHE_REDIS_DB', 'REDIS_DB', 'redis.db', 'cache.redis.db'],
      0,
      {
        min: 0,
        max: 15,
      },
    );

    const connectTimeoutMs = this.getNumberConfig(
      [
        'CACHE_REDIS_CONNECT_TIMEOUT_MS',
        'REDIS_CONNECT_TIMEOUT_MS',
        'redis.connectTimeoutMs',
        'cache.redis.connectTimeoutMs',
      ],
      3_000,
      {
        min: 100,
        max: 60_000,
      },
    );

    const commandTimeoutMs = this.getNumberConfig(
      [
        'CACHE_REDIS_COMMAND_TIMEOUT_MS',
        'REDIS_COMMAND_TIMEOUT_MS',
        'redis.commandTimeoutMs',
        'cache.redis.commandTimeoutMs',
      ],
      3_000,
      {
        min: 100,
        max: 60_000,
      },
    );

    const maxRetries = this.getNumberConfig(
      [
        'CACHE_REDIS_MAX_RETRIES',
        'REDIS_MAX_RETRIES',
        'redis.maxRetries',
        'cache.redis.maxRetries',
      ],
      3,
      {
        min: 0,
        max: 20,
      },
    );

    return {
      enabled,
      required,
      url: redisUrl,
      host,
      port,
      password,
      db,
      tls,
      connectTimeoutMs,
      commandTimeoutMs,
      maxRetries,
    };
  }

  private getFirstConfigValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);

      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }

    return undefined;
  }

  private getOptionalBooleanConfig(
    keys: readonly string[],
  ): boolean | undefined {
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

    return undefined;
  }

  private getBooleanConfig(
    keys: readonly string[],
    defaultValue: boolean,
  ): boolean {
    return this.getOptionalBooleanConfig(keys) ?? defaultValue;
  }

  private getNumberConfig(
    keys: readonly string[],
    defaultValue: number,
    options?: {
      min?: number;
      max?: number;
    },
  ): number {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);
      const normalizedValue =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : Number.NaN;

      if (!Number.isFinite(normalizedValue)) {
        continue;
      }

      if (options?.min !== undefined && normalizedValue < options.min) {
        continue;
      }

      if (options?.max !== undefined && normalizedValue > options.max) {
        continue;
      }

      return Math.trunc(normalizedValue);
    }

    return defaultValue;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'خطای نامشخص Redis';
  }
}
