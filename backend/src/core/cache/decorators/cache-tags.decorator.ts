import { SetMetadata, type ExecutionContext } from '@nestjs/common';

import { CACHE_TAGS_METADATA } from '../cache-metadata.constants';

export type CacheTagsFactory = (context: ExecutionContext) => readonly string[];

export type CacheTagsMetadata = readonly string[] | CacheTagsFactory;

export function CacheTags(tags: CacheTagsMetadata): MethodDecorator {
  return SetMetadata(CACHE_TAGS_METADATA, tags);
}
