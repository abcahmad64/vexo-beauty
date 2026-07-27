import { SetMetadata } from '@nestjs/common';

import { CACHE_TTL_METADATA } from '../cache-metadata.constants';

export function CacheTtl(ttlSeconds: number): MethodDecorator {
  const normalizedTtlSeconds =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.trunc(ttlSeconds) : 0;

  return SetMetadata(CACHE_TTL_METADATA, normalizedTtlSeconds);
}
