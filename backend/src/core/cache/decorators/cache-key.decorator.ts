import { SetMetadata, type ExecutionContext } from '@nestjs/common';

import { CACHE_KEY_METADATA } from '../cache-metadata.constants';

export type CacheKeyFactory = (context: ExecutionContext) => string;

export type CacheKeyMetadata = string | CacheKeyFactory;

export function CacheKey(key: CacheKeyMetadata): MethodDecorator {
  return SetMetadata(CACHE_KEY_METADATA, key);
}
