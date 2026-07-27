export enum CacheInvalidationEventType {
  INVALIDATE_KEY = 'cache.invalidate_key',
  INVALIDATE_KEYS = 'cache.invalidate_keys',
  INVALIDATE_PATTERN = 'cache.invalidate_pattern',
  INVALIDATE_NAMESPACE = 'cache.invalidate_namespace',
  INVALIDATE_TAG = 'cache.invalidate_tag',
  INVALIDATE_TAGS = 'cache.invalidate_tags',
  FLUSH_ALL = 'cache.flush_all',
}

export interface CacheInvalidationBasePayload {
  readonly actorId?: string | null;
  readonly occurredAt?: Date;
}

export interface CacheInvalidateKeyPayload extends CacheInvalidationBasePayload {
  readonly key: string;
}

export interface CacheInvalidateKeysPayload extends CacheInvalidationBasePayload {
  readonly keys: readonly string[];
}

export interface CacheInvalidatePatternPayload extends CacheInvalidationBasePayload {
  readonly pattern: string;
}

export interface CacheInvalidateNamespacePayload extends CacheInvalidationBasePayload {
  readonly namespace: string;
}

export interface CacheInvalidateTagPayload extends CacheInvalidationBasePayload {
  readonly tag: string;
}

export interface CacheInvalidateTagsPayload extends CacheInvalidationBasePayload {
  readonly tags: readonly string[];
}

export type CacheFlushAllPayload = CacheInvalidationBasePayload;
