import { Injectable } from '@nestjs/common';

import { CacheService } from './cache.service';
import type {
  CacheInvalidationOptions,
  CacheInvalidationResult,
} from './interfaces/cache-invalidation.interface';

@Injectable()
export class CacheInvalidatorService {
  constructor(private readonly cacheService: CacheService) {}

  async invalidate(
    options: CacheInvalidationOptions,
  ): Promise<CacheInvalidationResult> {
    const actions: string[] = [];

    if (options.flush) {
      await this.cacheService.flush();
      actions.push('flush');
    }

    const key = this.normalizeString(options.key);

    if (key) {
      await this.cacheService.del(key);
      actions.push(`key:${key}`);
    }

    const keys = this.normalizeStringArray(options.keys);

    if (keys.length > 0) {
      await this.cacheService.del(...keys);
      actions.push(`keys:${keys.length}`);
    }

    const pattern = this.normalizeString(options.pattern);

    if (pattern) {
      await this.cacheService.deleteByPattern(pattern);
      actions.push(`pattern:${pattern}`);
    }

    const namespace = this.normalizeString(options.namespace);

    if (namespace) {
      await this.cacheService.deleteNamespace(namespace);
      actions.push(`namespace:${namespace}`);
    }

    const tag = this.normalizeString(options.tag);

    if (tag) {
      await this.cacheService.deleteByTag(tag);
      actions.push(`tag:${tag}`);
    }

    const tags = this.normalizeStringArray(options.tags);

    if (tags.length > 0) {
      for (const item of tags) {
        await this.cacheService.deleteByTag(item);
      }

      actions.push(`tags:${tags.length}`);
    }

    return {
      invalidated: actions.length > 0,
      actions,
      actorId: options.actorId ?? null,
      occurredAt: new Date(),
    };
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeStringArray(
    values: readonly string[] | null | undefined,
  ): string[] {
    if (values == null || values.length === 0) {
      return [];
    }

    return Array.from(
      new Set(
        values
          .map((value) => this.normalizeString(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }
}
