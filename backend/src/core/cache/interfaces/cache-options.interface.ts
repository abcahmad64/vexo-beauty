export type CacheDriver = 'redis' | 'memory' | 'disabled';

export type CacheKeyPart = string | number | boolean | Date | null | undefined;

export interface CacheSetOptions {
  readonly ttlSeconds?: number;
  readonly tags?: readonly string[];
}

export interface CacheRememberOptions extends CacheSetOptions {
  readonly ttlSeconds: number;
}

export interface CacheStatus {
  readonly enabled: boolean;
  readonly redisEnabled: boolean;
  readonly redisConnected: boolean;
  readonly driver: CacheDriver;
  readonly keyPrefix: string;
}
