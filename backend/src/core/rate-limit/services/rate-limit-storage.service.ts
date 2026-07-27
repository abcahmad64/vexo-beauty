import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

import { RATE_LIMIT_REDIS_BLOCK_SUFFIX } from '../constants/rate-limit.constants';
import type {
  MemoryRateLimitEntry,
  RateLimitDecision,
  RateLimitIncrementInput,
} from '../types/rate-limit.types';
import { RateLimitConfigService } from './rate-limit-config.service';

const RATE_LIMIT_INCREMENT_SCRIPT = `
local counterKey = KEYS[1]
local blockKey = KEYS[2]
local limit = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local activeBlockTtl = redis.call('PTTL', blockKey)

if activeBlockTtl > 0 then
  local currentHits = tonumber(redis.call('GET', counterKey)) or (limit + 1)
  return { 0, currentHits, activeBlockTtl, activeBlockTtl }
end

local totalHits = redis.call('INCR', counterKey)
local currentTtl = redis.call('PTTL', counterKey)

if totalHits == 1 or currentTtl < 0 then
  redis.call('PEXPIRE', counterKey, ttlMs)
  currentTtl = ttlMs
end

if totalHits > limit then
  redis.call('PSETEX', blockKey, blockMs, '1')
  return { 0, totalHits, blockMs, blockMs }
end

return { 1, totalHits, currentTtl, 0 }
`;

@Injectable()
export class RateLimitStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly memoryStore = new Map<string, MemoryRateLimitEntry>();

  private redisClient: Redis | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private redisConfigured = false;
  private redisRequired = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitConfigService: RateLimitConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.cleanupTimer = setInterval(() => this.cleanupMemoryStore(), 60_000);
    this.cleanupTimer.unref();

    const config = this.rateLimitConfigService.getConfig();
    this.redisConfigured = config.storageDriver === 'redis';
    this.redisRequired = config.redisRequired;

    if (!this.redisConfigured) {
      return;
    }

    let redisClient: Redis | null = null;

    try {
      redisClient = this.createRedisClient();
      this.redisClient = redisClient;
      this.attachRedisListeners(redisClient);

      await redisClient.connect();

      const ping = await redisClient.ping();

      if (ping !== 'PONG') {
        throw new Error('Unexpected Redis PING response.');
      }
    } catch {
      if (redisClient) {
        redisClient.disconnect();
      }

      this.redisClient = null;

      if (this.redisRequired) {
        throw new ServiceUnavailableException(
          'اتصال Redis برای Rate Limit برقرار نشد.',
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.redisClient) {
      const client = this.redisClient;
      this.redisClient = null;

      if (client.status === 'ready') {
        await client.quit();
        return;
      }

      client.disconnect();
    }
  }

  async increment(input: RateLimitIncrementInput): Promise<RateLimitDecision> {
    if (!this.redisConfigured) {
      return this.incrementMemory(input);
    }

    if (this.redisClient?.status !== 'ready') {
      return this.handleRedisUnavailable(input);
    }

    try {
      return await this.incrementRedis(input);
    } catch {
      return this.handleRedisUnavailable(input);
    }
  }

  private async incrementRedis(
    input: RateLimitIncrementInput,
  ): Promise<RateLimitDecision> {
    const redisClient = this.redisClient;

    if (!redisClient || redisClient.status !== 'ready') {
      return this.handleRedisUnavailable(input);
    }

    const now = Date.now();
    const blockKey = `${input.key}${RATE_LIMIT_REDIS_BLOCK_SUFFIX}`;
    const rawResult = await redisClient.eval(
      RATE_LIMIT_INCREMENT_SCRIPT,
      2,
      input.key,
      blockKey,
      String(input.limit),
      String(input.ttlMs),
      String(input.blockMs),
    );
    const [allowedValue, totalHits, resetTtlMs, retryAfterMs] =
      this.parseRedisDecision(rawResult);

    if (allowedValue === 1) {
      return this.createAllowedDecision(
        input,
        totalHits,
        now + Math.max(resetTtlMs, 1_000),
      );
    }

    return this.createBlockedDecision(
      input,
      totalHits,
      Math.max(retryAfterMs, 1_000),
      now + Math.max(resetTtlMs, retryAfterMs, 1_000),
    );
  }

  private handleRedisUnavailable(
    input: RateLimitIncrementInput,
  ): RateLimitDecision {
    if (this.redisRequired) {
      throw new ServiceUnavailableException(
        'سرویس کنترل نرخ درخواست موقتاً در دسترس نیست.',
      );
    }

    return this.incrementMemory(input);
  }

  private parseRedisDecision(
    value: unknown,
  ): readonly [number, number, number, number] {
    if (!Array.isArray(value) || value.length !== 4) {
      throw new Error('Invalid Redis rate-limit response.');
    }

    const parsed = value.map((item) => Number(item));

    if (parsed.some((item) => !Number.isFinite(item))) {
      throw new Error('Invalid Redis rate-limit response.');
    }

    return [
      Math.trunc(parsed[0]),
      Math.max(Math.trunc(parsed[1]), 0),
      Math.max(Math.trunc(parsed[2]), 0),
      Math.max(Math.trunc(parsed[3]), 0),
    ];
  }

  private incrementMemory(input: RateLimitIncrementInput): RateLimitDecision {
    const now = Date.now();
    const existing = this.memoryStore.get(input.key);

    if (
      existing &&
      existing.blockedUntil !== null &&
      existing.blockedUntil > now
    ) {
      return this.createBlockedDecision(
        input,
        existing.count,
        existing.blockedUntil - now,
        existing.blockedUntil,
      );
    }

    if (!existing || existing.expiresAt <= now) {
      const entry: MemoryRateLimitEntry = {
        count: 1,
        expiresAt: now + input.ttlMs,
        blockedUntil: null,
      };

      this.memoryStore.set(input.key, entry);

      return this.createAllowedDecision(input, entry.count, entry.expiresAt);
    }

    existing.count += 1;

    if (existing.count > input.limit) {
      existing.blockedUntil = now + input.blockMs;
      this.memoryStore.set(input.key, existing);

      return this.createBlockedDecision(
        input,
        existing.count,
        input.blockMs,
        existing.blockedUntil,
      );
    }

    this.memoryStore.set(input.key, existing);

    return this.createAllowedDecision(
      input,
      existing.count,
      existing.expiresAt,
    );
  }

  private createAllowedDecision(
    input: RateLimitIncrementInput,
    totalHits: number,
    resetAt: number,
  ): RateLimitDecision {
    return {
      allowed: true,
      profile: input.profile,
      key: input.key,
      tracker: input.tracker,
      limit: input.limit,
      remaining: Math.max(input.limit - totalHits, 0),
      totalHits,
      ttlMs: input.ttlMs,
      blockMs: input.blockMs,
      resetAt: new Date(resetAt),
      retryAfterMs: 0,
    };
  }

  private createBlockedDecision(
    input: RateLimitIncrementInput,
    totalHits: number,
    retryAfterMs: number,
    resetAt: number,
  ): RateLimitDecision {
    return {
      allowed: false,
      profile: input.profile,
      key: input.key,
      tracker: input.tracker,
      limit: input.limit,
      remaining: 0,
      totalHits,
      ttlMs: input.ttlMs,
      blockMs: input.blockMs,
      resetAt: new Date(resetAt),
      retryAfterMs: Math.max(retryAfterMs, 1_000),
    };
  }

  private createRedisClient(): Redis {
    const redisUrl = this.getString(
      ['RATE_LIMIT_REDIS_URL', 'REDIS_URL', 'redis.url'],
      '',
    );

    const options = this.getRedisOptions();

    if (redisUrl.length > 0) {
      return new Redis(redisUrl, options);
    }

    return new Redis(options);
  }

  private getRedisOptions(): RedisOptions {
    const tlsEnabled = this.getBoolean(
      ['RATE_LIMIT_REDIS_TLS', 'REDIS_TLS', 'redis.tls'],
      false,
    );

    const password = this.getString(
      ['RATE_LIMIT_REDIS_PASSWORD', 'REDIS_PASSWORD', 'redis.password'],
      '',
    );

    const options: RedisOptions = {
      host: this.getString(
        ['RATE_LIMIT_REDIS_HOST', 'REDIS_HOST', 'redis.host'],
        '127.0.0.1',
      ),
      port: this.getNumber(
        ['RATE_LIMIT_REDIS_PORT', 'REDIS_PORT', 'redis.port'],
        6379,
        {
          min: 1,
          max: 65_535,
        },
      ),
      db: this.getNumber(['RATE_LIMIT_REDIS_DB', 'REDIS_DB', 'redis.db'], 0, {
        min: 0,
        max: 15,
      }),
      connectTimeout: this.getNumber(
        [
          'RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS',
          'REDIS_CONNECT_TIMEOUT_MS',
          'redis.connectTimeoutMs',
        ],
        3_000,
        {
          min: 100,
          max: 60_000,
        },
      ),
      commandTimeout: this.getNumber(
        [
          'RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS',
          'REDIS_COMMAND_TIMEOUT_MS',
          'redis.commandTimeoutMs',
        ],
        3_000,
        {
          min: 100,
          max: 60_000,
        },
      ),
      maxRetriesPerRequest: this.getNumber(
        [
          'RATE_LIMIT_REDIS_MAX_RETRIES',
          'REDIS_MAX_RETRIES',
          'redis.maxRetries',
        ],
        3,
        {
          min: 0,
          max: 10,
        },
      ),
      lazyConnect: true,
      enableReadyCheck: true,
      enableOfflineQueue: false,
    };

    if (password.length > 0) {
      options.password = password;
    }

    if (tlsEnabled) {
      options.tls = {};
    }

    return options;
  }

  private attachRedisListeners(redisClient: Redis): void {
    redisClient.on('error', () => {
      return;
    });
  }

  private cleanupMemoryStore(): void {
    const now = Date.now();

    for (const [key, value] of this.memoryStore.entries()) {
      const isWindowExpired = value.expiresAt <= now;
      const isBlockExpired =
        value.blockedUntil === null || value.blockedUntil <= now;

      if (isWindowExpired && isBlockExpired) {
        this.memoryStore.delete(key);
      }
    }
  }

  private getString(keys: readonly string[], fallback: string): string {
    for (const key of keys) {
      const configValue = this.normalizeConfigValue(
        this.configService.get<string | number | boolean>(key),
      );

      if (configValue) {
        return configValue;
      }

      const envValue = this.normalizeConfigValue(process.env[key]);

      if (envValue) {
        return envValue;
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
      const parsedFromConfig = this.parseBoolean(
        this.configService.get<boolean | string | number>(key),
      );

      if (parsedFromConfig !== null) {
        return parsedFromConfig;
      }

      const parsedFromEnv = this.parseBoolean(process.env[key]);

      if (parsedFromEnv !== null) {
        return parsedFromEnv;
      }
    }

    return fallback;
  }

  private parseBoolean(value: unknown): boolean | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue.length === 0) {
      return null;
    }

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return null;
  }

  private normalizeConfigValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }
}
