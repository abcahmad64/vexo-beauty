export type RateLimitStorageDriver = 'memory' | 'redis';

export type RateLimitProfile =
  | 'default'
  | 'public'
  | 'auth'
  | 'sensitive'
  | 'upload'
  | 'search'
  | 'admin'
  | 'ai';

export interface RateLimitRule {
  readonly profile: RateLimitProfile;
  readonly limit: number;
  readonly ttlMs: number;
  readonly blockMs: number;
  readonly message: string;
}

export interface RateLimitCustomOptions {
  readonly profile?: RateLimitProfile;
  readonly limit?: number;
  readonly ttlMs?: number;
  readonly blockMs?: number;
  readonly message?: string;
}

export interface RateLimitConfig {
  readonly enabled: boolean;
  readonly storageDriver: RateLimitStorageDriver;
  readonly redisRequired: boolean;
  readonly trustProxy: boolean;
  readonly keyPrefix: string;
  readonly skipPaths: readonly string[];
  readonly profiles: Readonly<Record<RateLimitProfile, RateLimitRule>>;
}

export interface RateLimitIncrementInput {
  readonly key: string;
  readonly profile: RateLimitProfile;
  readonly tracker: string;
  readonly limit: number;
  readonly ttlMs: number;
  readonly blockMs: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly profile: RateLimitProfile;
  readonly key: string;
  readonly tracker: string;
  readonly limit: number;
  readonly remaining: number;
  readonly totalHits: number;
  readonly ttlMs: number;
  readonly blockMs: number;
  readonly resetAt: Date;
  readonly retryAfterMs: number;
}

export interface MemoryRateLimitEntry {
  count: number;
  expiresAt: number;
  blockedUntil: number | null;
}

export interface RateLimitUserIdentity {
  readonly id?: string | null;
  readonly userId?: string | null;
  readonly sub?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly mobile?: string | null;
  readonly role?: string | null;
  readonly roles?: readonly string[];
}
