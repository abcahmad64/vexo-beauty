export interface CacheEntry<T> {
  readonly value: T;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly ttlSeconds: number | null;
  readonly tags: readonly string[];
}

export interface SerializedCacheEntry {
  readonly value: unknown;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly ttlSeconds: number | null;
  readonly tags: readonly string[];
}
