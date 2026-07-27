import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  RATE_LIMIT_ALWAYS_SKIPPED_PATHS,
  RATE_LIMIT_DEFAULT_KEY_PREFIX,
  RATE_LIMIT_PROFILE_DEFAULTS,
  RATE_LIMIT_PROFILE_ENV_KEYS,
} from '../constants/rate-limit.constants';
import type {
  RateLimitConfig,
  RateLimitCustomOptions,
  RateLimitProfile,
  RateLimitRule,
  RateLimitStorageDriver,
} from '../types/rate-limit.types';

type ConfigPrimitive = string | number | boolean | string[];

@Injectable()
export class RateLimitConfigService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): RateLimitConfig {
    return {
      enabled: this.getBoolean(
        ['RATE_LIMIT_ENABLED', 'rateLimit.enabled'],
        true,
      ),
      storageDriver: this.getStorageDriver(),
      redisRequired: this.getBoolean(
        [
          'RATE_LIMIT_REDIS_REQUIRED',
          'rateLimit.redisRequired',
          'rateLimit.redis.required',
        ],
        false,
      ),
      trustProxy: this.getBoolean(
        ['RATE_LIMIT_TRUST_PROXY', 'TRUST_PROXY', 'rateLimit.trustProxy'],
        false,
      ),
      keyPrefix: this.getString(
        ['RATE_LIMIT_KEY_PREFIX', 'rateLimit.keyPrefix'],
        RATE_LIMIT_DEFAULT_KEY_PREFIX,
      ),
      skipPaths: this.getSkipPaths(),
      profiles: this.getProfileRules(),
    };
  }

  resolveRule(
    profile: RateLimitProfile,
    options?: RateLimitCustomOptions,
  ): RateLimitRule {
    const config = this.getConfig();
    const baseRule =
      config.profiles[profile] ?? RATE_LIMIT_PROFILE_DEFAULTS.default;

    return {
      profile,
      limit: this.normalizePositiveInteger(options?.limit, baseRule.limit),
      ttlMs: this.normalizePositiveInteger(options?.ttlMs, baseRule.ttlMs),
      blockMs: this.normalizePositiveInteger(
        options?.blockMs,
        baseRule.blockMs,
      ),
      message: this.normalizeMessage(options?.message, baseRule.message),
    };
  }

  isPathSkipped(path: string): boolean {
    const normalizedPath = this.normalizePath(path);

    if (!normalizedPath) {
      return false;
    }

    return this.getConfig().skipPaths.some((skipPath) => {
      const normalizedSkipPath = this.normalizePath(skipPath);

      return (
        normalizedSkipPath.length > 0 &&
        (normalizedPath === normalizedSkipPath ||
          normalizedPath.startsWith(`${normalizedSkipPath}/`))
      );
    });
  }

  private getProfileRules(): Readonly<Record<RateLimitProfile, RateLimitRule>> {
    return {
      default: this.getRuleFromEnv('default'),
      public: this.getRuleFromEnv('public'),
      auth: this.getRuleFromEnv('auth'),
      sensitive: this.getRuleFromEnv('sensitive'),
      upload: this.getRuleFromEnv('upload'),
      search: this.getRuleFromEnv('search'),
      admin: this.getRuleFromEnv('admin'),
      ai: this.getRuleFromEnv('ai'),
    };
  }

  private getRuleFromEnv(profile: RateLimitProfile): RateLimitRule {
    const defaults = RATE_LIMIT_PROFILE_DEFAULTS[profile];
    const keys = RATE_LIMIT_PROFILE_ENV_KEYS[profile];

    return {
      profile,
      limit: this.getNumber(
        [keys.limit, `rateLimit.profiles.${profile}.limit`],
        defaults.limit,
        {
          min: 1,
          max: 100_000,
        },
      ),
      ttlMs: this.getNumber(
        [keys.ttlMs, `rateLimit.profiles.${profile}.ttlMs`],
        defaults.ttlMs,
        {
          min: 1_000,
          max: 86_400_000,
        },
      ),
      blockMs: this.getNumber(
        [keys.blockMs, `rateLimit.profiles.${profile}.blockMs`],
        defaults.blockMs,
        {
          min: 1_000,
          max: 86_400_000,
        },
      ),
      message: defaults.message,
    };
  }

  private getStorageDriver(): RateLimitStorageDriver {
    const value = this.getString(
      ['RATE_LIMIT_STORAGE_DRIVER', 'rateLimit.storageDriver'],
      'memory',
    )
      .trim()
      .toLowerCase();

    return value === 'redis' ? 'redis' : 'memory';
  }

  private getSkipPaths(): readonly string[] {
    const configuredPaths = this.getStringArray(
      ['RATE_LIMIT_SKIP_PATHS', 'rateLimit.skipPaths'],
      [],
    );

    const paths = [...RATE_LIMIT_ALWAYS_SKIPPED_PATHS, ...configuredPaths]
      .map((item) => this.normalizePath(item))
      .filter((item) => item.length > 0);

    return [...new Set(paths)];
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim();

    if (trimmed.length === 0) {
      return '';
    }

    const withoutQuery = trimmed.split('?')[0] ?? trimmed;
    const withLeadingSlash = withoutQuery.startsWith('/')
      ? withoutQuery
      : `/${withoutQuery}`;

    return withLeadingSlash.replace(/\/+$/gu, '') || '/';
  }

  private normalizePositiveInteger(
    value: number | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
      return fallback;
    }

    return Math.floor(value);
  }

  private normalizeMessage(
    value: string | undefined,
    fallback: string,
  ): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return fallback;
  }

  private getString(keys: readonly string[], fallback: string): string {
    for (const key of keys) {
      const configValue = this.normalizeConfigValue(
        this.configService.get<ConfigPrimitive>(key),
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

  private getStringArray(
    keys: readonly string[],
    fallback: readonly string[],
  ): string[] {
    for (const key of keys) {
      const value =
        this.configService.get<string | string[]>(key) ?? process.env[key];

      if (Array.isArray(value)) {
        const normalized = value
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);

        if (normalized.length > 0) {
          return normalized;
        }
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        const normalized = value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        if (normalized.length > 0) {
          return normalized;
        }
      }
    }

    return [...fallback];
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

    if (typeof value !== 'string' && typeof value !== 'bigint') {
      return null;
    }

    const normalizedValue =
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : value.toString().trim().toLowerCase();

    if (normalizedValue === '') {
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

    if (Array.isArray(value) && value.length > 0) {
      const normalizedValue = value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
        .join(',');

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    return undefined;
  }
}
