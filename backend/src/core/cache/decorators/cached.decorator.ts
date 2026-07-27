import { applyDecorators } from '@nestjs/common';

import { CacheKey, type CacheKeyMetadata } from './cache-key.decorator';
import { CacheTags, type CacheTagsMetadata } from './cache-tags.decorator';
import { CacheTtl } from './cache-ttl.decorator';

export interface CachedOptions {
  readonly key: CacheKeyMetadata;
  readonly ttlSeconds?: number;
  readonly tags?: CacheTagsMetadata;
}

export function Cached(options: CachedOptions): MethodDecorator {
  const decorators: MethodDecorator[] = [CacheKey(options.key)];

  const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds);

  if (ttlSeconds !== null) {
    decorators.push(CacheTtl(ttlSeconds));
  }

  if (options.tags) {
    decorators.push(CacheTags(options.tags));
  }

  return applyDecorators(...decorators);
}

function normalizeTtlSeconds(ttlSeconds: number | undefined): number | null {
  if (
    typeof ttlSeconds !== 'number' ||
    !Number.isFinite(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    return null;
  }

  return Math.trunc(ttlSeconds);
}
