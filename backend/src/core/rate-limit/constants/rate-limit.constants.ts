import type {
  RateLimitProfile,
  RateLimitRule,
} from '../types/rate-limit.types';

export const RATE_LIMIT_METADATA = {
  SKIP: 'vexo:rate-limit:skip',
  PROFILE: 'vexo:rate-limit:profile',
  OPTIONS: 'vexo:rate-limit:options',
} as const;

export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  PROFILE: 'X-RateLimit-Profile',
  RETRY_AFTER: 'Retry-After',
} as const;

export const RATE_LIMIT_DEFAULT_KEY_PREFIX = 'vexo:rate-limit';

export const RATE_LIMIT_PROFILE_DEFAULTS: Readonly<
  Record<RateLimitProfile, RateLimitRule>
> = {
  default: {
    profile: 'default',
    limit: 120,
    ttlMs: 60_000,
    blockMs: 60_000,
    message:
      'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  public: {
    profile: 'public',
    limit: 180,
    ttlMs: 60_000,
    blockMs: 60_000,
    message:
      'تعداد درخواست‌های عمومی بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  auth: {
    profile: 'auth',
    limit: 10,
    ttlMs: 60_000,
    blockMs: 120_000,
    message:
      'تعداد تلاش‌های احراز هویت بیش از حد مجاز است. لطفاً چند دقیقه بعد دوباره تلاش کنید.',
  },
  sensitive: {
    profile: 'sensitive',
    limit: 30,
    ttlMs: 60_000,
    blockMs: 120_000,
    message:
      'تعداد درخواست‌های حساس بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  upload: {
    profile: 'upload',
    limit: 20,
    ttlMs: 60_000,
    blockMs: 120_000,
    message:
      'تعداد درخواست‌های آپلود بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  search: {
    profile: 'search',
    limit: 60,
    ttlMs: 60_000,
    blockMs: 60_000,
    message:
      'تعداد درخواست‌های جستجو بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  admin: {
    profile: 'admin',
    limit: 90,
    ttlMs: 60_000,
    blockMs: 120_000,
    message:
      'تعداد درخواست‌های مدیریتی بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
  ai: {
    profile: 'ai',
    limit: 20,
    ttlMs: 60_000,
    blockMs: 180_000,
    message:
      'تعداد درخواست‌های هوش مصنوعی بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  },
};

export const RATE_LIMIT_ALWAYS_SKIPPED_PATHS = [
  '/health',
  '/health/liveness',
  '/health/readiness',
  '/health/version',
  '/health/dependencies',
  '/health/database',
  '/health/redis',
  '/health/queue',
  '/health/storage',
  '/health/ai',
  '/docs',
  '/docs-json',
  '/docs-yaml',
] as const;

export const RATE_LIMIT_PROFILE_ENV_KEYS: Readonly<
  Record<
    RateLimitProfile,
    {
      readonly limit: string;
      readonly ttlMs: string;
      readonly blockMs: string;
    }
  >
> = {
  default: {
    limit: 'RATE_LIMIT_DEFAULT_LIMIT',
    ttlMs: 'RATE_LIMIT_DEFAULT_TTL_MS',
    blockMs: 'RATE_LIMIT_DEFAULT_BLOCK_MS',
  },
  public: {
    limit: 'RATE_LIMIT_PUBLIC_LIMIT',
    ttlMs: 'RATE_LIMIT_PUBLIC_TTL_MS',
    blockMs: 'RATE_LIMIT_PUBLIC_BLOCK_MS',
  },
  auth: {
    limit: 'RATE_LIMIT_AUTH_LIMIT',
    ttlMs: 'RATE_LIMIT_AUTH_TTL_MS',
    blockMs: 'RATE_LIMIT_AUTH_BLOCK_MS',
  },
  sensitive: {
    limit: 'RATE_LIMIT_SENSITIVE_LIMIT',
    ttlMs: 'RATE_LIMIT_SENSITIVE_TTL_MS',
    blockMs: 'RATE_LIMIT_SENSITIVE_BLOCK_MS',
  },
  upload: {
    limit: 'RATE_LIMIT_UPLOAD_LIMIT',
    ttlMs: 'RATE_LIMIT_UPLOAD_TTL_MS',
    blockMs: 'RATE_LIMIT_UPLOAD_BLOCK_MS',
  },
  search: {
    limit: 'RATE_LIMIT_SEARCH_LIMIT',
    ttlMs: 'RATE_LIMIT_SEARCH_TTL_MS',
    blockMs: 'RATE_LIMIT_SEARCH_BLOCK_MS',
  },
  admin: {
    limit: 'RATE_LIMIT_ADMIN_LIMIT',
    ttlMs: 'RATE_LIMIT_ADMIN_TTL_MS',
    blockMs: 'RATE_LIMIT_ADMIN_BLOCK_MS',
  },
  ai: {
    limit: 'RATE_LIMIT_AI_LIMIT',
    ttlMs: 'RATE_LIMIT_AI_TTL_MS',
    blockMs: 'RATE_LIMIT_AI_BLOCK_MS',
  },
};

export const RATE_LIMIT_REDIS_BLOCK_SUFFIX = ':blocked';
