import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisManagerService } from './redis-manager.service';
import type { SerializedCacheEntry } from './interfaces/cache-entry.interface';
import type {
  CacheSetOptions,
  CacheStatus,
} from './interfaces/cache-options.interface';

type MemoryCacheEntry = {
  readonly value: string;
  readonly expiresAt: number | null;
  readonly tags: readonly string[];
};

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private readonly memory = new Map<string, MemoryCacheEntry>();

  private readonly memoryTags = new Map<string, Set<string>>();

  private readonly enabled: boolean;

  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisManagerService: RedisManagerService,
  ) {
    this.enabled = this.getBooleanConfig(
      ['cache.enabled', 'CACHE_ENABLED'],
      true,
    );

    this.keyPrefix = this.normalizeKeyPrefix(
      this.getFirstConfigValue(['cache.keyPrefix', 'CACHE_KEY_PREFIX']) ??
        'vexo',
    );
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    const physicalKey = this.toPhysicalKey(key);

    if (!physicalKey) {
      return null;
    }

    const redis = this.redisManagerService.getClient();

    const raw = redis
      ? await this.safeRedisGet(physicalKey)
      : this.getFromMemory(physicalKey);

    if (!raw) {
      return null;
    }

    const entry = this.deserialize(raw);

    if (!entry) {
      await this.del(key);
      return null;
    }

    if (this.isExpired(entry)) {
      await this.del(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(
    key: string,
    value: T,
    optionsOrTtlSeconds?: CacheSetOptions | number,
  ): Promise<void> {
    if (!this.enabled || typeof value === 'undefined') {
      return;
    }

    const physicalKey = this.toPhysicalKey(key);

    if (!physicalKey) {
      return;
    }

    const options = this.normalizeSetOptions(optionsOrTtlSeconds);
    const tags = this.normalizeTags(options.tags);
    const ttlSeconds = this.normalizeTtl(options.ttlSeconds);
    const now = new Date();

    const entry: SerializedCacheEntry = {
      value,
      createdAt: now.toISOString(),
      expiresAt:
        ttlSeconds > 0
          ? new Date(now.getTime() + ttlSeconds * 1000).toISOString()
          : null,
      ttlSeconds: ttlSeconds > 0 ? ttlSeconds : null,
      tags,
    };

    const serialized = JSON.stringify(entry);
    const redis = this.redisManagerService.getClient();

    if (redis) {
      const storedInRedis = await this.safeRedisSet(
        physicalKey,
        serialized,
        ttlSeconds,
      );

      if (storedInRedis) {
        await this.safeAttachRedisTags(physicalKey, tags, ttlSeconds);
        return;
      }
    }

    this.setToMemory(physicalKey, serialized, ttlSeconds, tags);
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
    options?: Omit<CacheSetOptions, 'ttlSeconds'>,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();

    await this.set(key, value, {
      ttlSeconds,
      tags: options?.tags,
    });

    return value;
  }

  async del(...keys: readonly string[]): Promise<void> {
    if (!this.enabled || keys.length === 0) {
      return;
    }

    const physicalKeys = keys
      .map((key) => this.toPhysicalKey(key))
      .filter((key): key is string => Boolean(key));

    if (physicalKeys.length === 0) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        for (const physicalKey of physicalKeys) {
          await this.detachRedisTags(physicalKey);
        }

        await redis.del(...physicalKeys);
        return;
      } catch (error) {
        this.logger.warn(
          `حذف داده از Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    for (const physicalKey of physicalKeys) {
      this.deleteMemoryKey(physicalKey);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const physicalKey = this.toPhysicalKey(key);

    if (!physicalKey) {
      return false;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        const result = await redis.exists(physicalKey);

        return result === 1;
      } catch (error) {
        this.logger.warn(
          `بررسی وجود کلید در Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    return this.getFromMemory(physicalKey) !== null;
  }

  async ttl(key: string): Promise<number | null> {
    if (!this.enabled) {
      return null;
    }

    const physicalKey = this.toPhysicalKey(key);

    if (!physicalKey) {
      return null;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        const result = await redis.ttl(physicalKey);

        if (result < 0) {
          return null;
        }

        return result;
      } catch (error) {
        this.logger.warn(
          `خواندن TTL از Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    const entry = this.memory.get(physicalKey);

    if (!entry || entry.expiresAt === null) {
      return null;
    }

    const remainingMs = entry.expiresAt - Date.now();

    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : null;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.enabled || ttlSeconds <= 0) {
      return;
    }

    const physicalKey = this.toPhysicalKey(key);

    if (!physicalKey) {
      return;
    }

    const normalizedTtl = this.normalizeTtl(ttlSeconds);

    if (normalizedTtl <= 0) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        await redis.expire(physicalKey, normalizedTtl);
        return;
      } catch (error) {
        this.logger.warn(
          `تنظیم TTL در Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    const entry = this.memory.get(physicalKey);

    if (!entry) {
      return;
    }

    this.memory.set(physicalKey, {
      ...entry,
      expiresAt: Date.now() + normalizedTtl * 1000,
    });
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const physicalPattern = this.toPhysicalPattern(pattern);

    if (!physicalPattern) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        const stream = redis.scanStream({
          match: physicalPattern,
          count: 250,
        }) as AsyncIterable<readonly string[]>;

        for await (const keys of stream) {
          const normalizedKeys = keys.filter(Boolean);

          if (normalizedKeys.length === 0) {
            continue;
          }

          for (const physicalKey of normalizedKeys) {
            await this.detachRedisTags(physicalKey);
          }

          await redis.del(...normalizedKeys);
        }

        return;
      } catch (error) {
        this.logger.warn(
          `حذف کش با pattern از Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    for (const key of Array.from(this.memory.keys())) {
      if (this.matchesPattern(key, physicalPattern)) {
        this.deleteMemoryKey(key);
      }
    }
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const normalizedNamespace = namespace.trim();

    if (!normalizedNamespace) {
      return;
    }

    await this.deleteByPattern(`${normalizedNamespace}:*`);
  }

  async deleteByTag(tag: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const normalizedTag = this.normalizeTag(tag);

    if (!normalizedTag) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        const tagKey = this.toTagKey(normalizedTag);
        const keys = await redis.smembers(tagKey);

        for (const physicalKey of keys) {
          await this.detachRedisTags(physicalKey);
        }

        if (keys.length > 0) {
          await redis.del(...keys);
        }

        await redis.del(tagKey);
        return;
      } catch (error) {
        this.logger.warn(
          `حذف کش با tag از Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    const taggedKeys = this.memoryTags.get(normalizedTag);

    if (!taggedKeys) {
      return;
    }

    for (const key of Array.from(taggedKeys)) {
      this.deleteMemoryKey(key);
    }

    this.memoryTags.delete(normalizedTag);
  }

  async flush(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (redis) {
      try {
        await redis.flushdb();
        return;
      } catch (error) {
        this.logger.warn(
          `پاک‌سازی Redis cache ناموفق بود: ${this.extractErrorMessage(error)}`,
        );
      }
    }

    this.memory.clear();
    this.memoryTags.clear();
  }

  getStatus(): CacheStatus {
    if (!this.enabled) {
      return {
        enabled: false,
        redisEnabled: this.redisManagerService.isEnabled(),
        redisConnected: false,
        driver: 'disabled',
        keyPrefix: this.keyPrefix,
      };
    }

    const redisConnected = this.redisManagerService.isConnected();

    return {
      enabled: true,
      redisEnabled: this.redisManagerService.isEnabled(),
      redisConnected,
      driver: redisConnected ? 'redis' : 'memory',
      keyPrefix: this.keyPrefix,
    };
  }

  private async safeRedisGet(physicalKey: string): Promise<string | null> {
    const redis = this.redisManagerService.getClient();

    if (!redis) {
      return null;
    }

    try {
      return await redis.get(physicalKey);
    } catch (error) {
      this.logger.warn(
        `خواندن کش از Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
      );

      return null;
    }
  }

  private async safeRedisSet(
    physicalKey: string,
    serialized: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const redis = this.redisManagerService.getClient();

    if (!redis) {
      return false;
    }

    try {
      if (ttlSeconds > 0) {
        await redis.set(physicalKey, serialized, 'EX', ttlSeconds);
      } else {
        await redis.set(physicalKey, serialized);
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `ثبت کش در Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
      );

      return false;
    }
  }

  private async safeAttachRedisTags(
    physicalKey: string,
    tags: readonly string[],
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.attachRedisTags(physicalKey, tags, ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `ثبت tagهای کش در Redis ناموفق بود: ${this.extractErrorMessage(error)}`,
      );
    }
  }

  private async attachRedisTags(
    physicalKey: string,
    tags: readonly string[],
    ttlSeconds: number,
  ): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const redis = this.redisManagerService.getClient();

    if (!redis) {
      return;
    }

    for (const tag of tags) {
      const tagKey = this.toTagKey(tag);

      await redis.sadd(tagKey, physicalKey);

      if (ttlSeconds > 0) {
        await redis.expire(tagKey, Math.max(ttlSeconds + 86_400, 86_400));
      }
    }
  }

  private async detachRedisTags(physicalKey: string): Promise<void> {
    const redis = this.redisManagerService.getClient();

    if (!redis) {
      return;
    }

    const raw = await redis.get(physicalKey);

    if (!raw) {
      return;
    }

    const entry = this.deserialize(raw);

    if (!entry || entry.tags.length === 0) {
      return;
    }

    for (const tag of entry.tags) {
      await redis.srem(this.toTagKey(tag), physicalKey);
    }
  }

  private getFromMemory(physicalKey: string): string | null {
    const entry = this.memory.get(physicalKey);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.deleteMemoryKey(physicalKey);
      return null;
    }

    return entry.value;
  }

  private setToMemory(
    physicalKey: string,
    value: string,
    ttlSeconds: number,
    tags: readonly string[],
  ): void {
    this.deleteMemoryKey(physicalKey);

    this.memory.set(physicalKey, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
      tags,
    });

    for (const tag of tags) {
      const existingSet = this.memoryTags.get(tag) ?? new Set<string>();

      existingSet.add(physicalKey);
      this.memoryTags.set(tag, existingSet);
    }
  }

  private deleteMemoryKey(physicalKey: string): void {
    const entry = this.memory.get(physicalKey);

    if (entry) {
      for (const tag of entry.tags) {
        const taggedKeys = this.memoryTags.get(tag);

        if (!taggedKeys) {
          continue;
        }

        taggedKeys.delete(physicalKey);

        if (taggedKeys.size === 0) {
          this.memoryTags.delete(tag);
        }
      }
    }

    this.memory.delete(physicalKey);
  }

  private deserialize(raw: string): SerializedCacheEntry | null {
    try {
      const parsed = JSON.parse(raw) as unknown;

      if (this.isSerializedCacheEntry(parsed)) {
        return parsed;
      }

      return {
        value: parsed,
        createdAt: new Date().toISOString(),
        expiresAt: null,
        ttlSeconds: null,
        tags: [],
      };
    } catch (error: unknown) {
      this.logger.warn(
        `داده کش قابل خواندن نیست: ${this.extractErrorMessage(error)}`,
      );

      return null;
    }
  }

  private isSerializedCacheEntry(
    value: unknown,
  ): value is SerializedCacheEntry {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const record = value as Record<string, unknown>;

    return (
      'value' in record &&
      typeof record.createdAt === 'string' &&
      (typeof record.expiresAt === 'string' || record.expiresAt === null) &&
      (typeof record.ttlSeconds === 'number' || record.ttlSeconds === null) &&
      Array.isArray(record.tags) &&
      record.tags.every((tag) => typeof tag === 'string')
    );
  }

  private isExpired(entry: SerializedCacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }

    const expiresAt = new Date(entry.expiresAt).getTime();

    return Number.isFinite(expiresAt) && expiresAt <= Date.now();
  }

  private normalizeSetOptions(
    optionsOrTtlSeconds?: CacheSetOptions | number,
  ): Required<CacheSetOptions> {
    if (typeof optionsOrTtlSeconds === 'number') {
      return {
        ttlSeconds: optionsOrTtlSeconds,
        tags: [],
      };
    }

    return {
      ttlSeconds: optionsOrTtlSeconds?.ttlSeconds ?? 0,
      tags: optionsOrTtlSeconds?.tags ?? [],
    };
  }

  private normalizeTtl(ttlSeconds: number | undefined): number {
    if (
      typeof ttlSeconds !== 'number' ||
      !Number.isFinite(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      return 0;
    }

    return Math.floor(ttlSeconds);
  }

  private normalizeTags(
    tags: readonly string[] | undefined,
  ): readonly string[] {
    if (!tags || tags.length === 0) {
      return [];
    }

    return Array.from(
      new Set(
        tags
          .map((tag) => this.normalizeTag(tag))
          .filter((tag): tag is string => Boolean(tag)),
      ),
    );
  }

  private normalizeTag(tag: string): string | null {
    const normalizedTag = tag.trim().toLowerCase().replace(/\s+/g, '-');

    return normalizedTag.length > 0 ? normalizedTag : null;
  }

  private normalizeKeyPrefix(prefix: string): string {
    return prefix.trim().replace(/^:+|:+$/g, '');
  }

  private toPhysicalKey(key: string): string | null {
    const normalizedKey = key.trim().replace(/^:+/, '');

    if (!normalizedKey) {
      return null;
    }

    if (this.keyPrefix.length === 0) {
      return normalizedKey;
    }

    if (normalizedKey.startsWith(`${this.keyPrefix}:`)) {
      return normalizedKey;
    }

    return `${this.keyPrefix}:${normalizedKey}`;
  }

  private toPhysicalPattern(pattern: string): string | null {
    const normalizedPattern = pattern.trim().replace(/^:+/, '');

    if (!normalizedPattern) {
      return null;
    }

    if (this.keyPrefix.length === 0) {
      return normalizedPattern;
    }

    if (normalizedPattern.startsWith(`${this.keyPrefix}:`)) {
      return normalizedPattern;
    }

    return `${this.keyPrefix}:${normalizedPattern}`;
  }

  private toTagKey(tag: string): string {
    return this.toPhysicalKey(`tag:${tag}`) ?? `tag:${tag}`;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);

    return regex.test(key);
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

  private getBooleanConfig(
    keys: readonly string[],
    defaultValue: boolean,
  ): boolean {
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

    return defaultValue;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'خطای نامشخص';
  }
}
