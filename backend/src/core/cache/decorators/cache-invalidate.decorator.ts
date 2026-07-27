import { SetMetadata } from '@nestjs/common';

import { CACHE_INVALIDATE_METADATA } from '../cache-metadata.constants';
import type { CacheInvalidationOptions } from '../interfaces/cache-invalidation.interface';

export function CacheInvalidate(
  options: CacheInvalidationOptions,
): MethodDecorator {
  return SetMetadata(CACHE_INVALIDATE_METADATA, normalizeOptions(options));
}

function normalizeOptions(
  options: CacheInvalidationOptions,
): CacheInvalidationOptions {
  return {
    key: normalizeString(options.key),
    keys: normalizeStringArray(options.keys),
    pattern: normalizeString(options.pattern),
    namespace: normalizeString(options.namespace),
    tag: normalizeString(options.tag),
    tags: normalizeStringArray(options.tags),
    flush: options.flush === true,
    actorId: normalizeString(options.actorId),
  };
}

function normalizeString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeStringArray(
  values: readonly string[] | null | undefined,
): readonly string[] | undefined {
  if (values == null || values.length === 0) {
    return undefined;
  }

  const normalizedValues = Array.from(
    new Set(
      values
        .map((value) => normalizeString(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}
