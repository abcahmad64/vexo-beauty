type RawEnv = Record<string, unknown>;

export type ValidNodeEnvironment =
  'development' | 'test' | 'staging' | 'production';

export type ValidRateLimitStorageDriver = 'memory' | 'redis';

export type ValidMediaStorageDriver = 'local' | 'bunny';

export type ValidPaymentGateway = 'zarinpal';

export type ValidPaymentCurrency = 'IRR';

export type ValidAiProvider = 'ollama';

export type ValidOllamaThinkMode = 'false' | 'true' | 'low' | 'medium' | 'high';

export interface ValidatedEnv extends Record<string, unknown> {
  NODE_ENV: ValidNodeEnvironment;
  APP_NAME: string;
  APP_VERSION: string;
  HOST: string;
  PORT: number;
  APP_URL: string;
  FRONTEND_URL: string;
  API_PREFIX: string;
  BODY_LIMIT: string;
  CORS_ORIGINS: string;
  CORS_CREDENTIALS: string;

  MEDIA_STORAGE_DRIVER: ValidMediaStorageDriver;
  STORAGE_DRIVER: ValidMediaStorageDriver;
  MEDIA_MAX_FILE_SIZE_BYTES: number;
  MEDIA_ALLOW_SVG: string;
  MEDIA_LOCAL_ROOT: string;
  LOCAL_UPLOAD_DIR: string;
  MEDIA_PUBLIC_BASE_URL: string;
  LOCAL_PUBLIC_BASE_URL: string;
  MEDIA_LOCAL_SERVE_ENABLED: string;
  MEDIA_STORAGE_REQUEST_TIMEOUT_MS: number;
  BUNNY_STORAGE_ENABLED: string;
  BUNNY_STORAGE_ZONE: string;
  BUNNY_STORAGE_ZONE_NAME: string;
  BUNNY_STORAGE_API_KEY: string;
  BUNNY_STORAGE_ACCESS_KEY: string;
  BUNNY_STORAGE_ENDPOINT: string;
  BUNNY_STORAGE_BASE_URL: string;
  BUNNY_CDN_URL: string;
  NEXT_PUBLIC_BUNNY_CDN_URL: string;

  DATABASE_URL: string;
  DATABASE_LOG_QUERIES: string;
  DATABASE_CONNECTION_TIMEOUT_MS: number;
  DATABASE_STATEMENT_TIMEOUT_MS: number;
  DATABASE_QUERY_TIMEOUT_MS: number;
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: number;
  DATABASE_TRANSACTION_TIMEOUT_MS: number;
  DATABASE_MAX_WAIT_MS: number;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
  DATABASE_POOL_IDLE_TIMEOUT_MS: number;
  DATABASE_POOL_MAX_LIFETIME_SECONDS: number;
  DATABASE_APPLICATION_NAME: string;
  DATABASE_MIGRATIONS_REQUIRED: string;

  DEFAULT_CURRENCY: ValidPaymentCurrency;
  PAYMENT_GATEWAY: ValidPaymentGateway;
  PAYMENT_CALLBACK_URL: string;
  PAYMENT_SANDBOX: string;
  PAYMENT_SUCCESS_REDIRECT_URL: string;
  PAYMENT_FAILURE_REDIRECT_URL: string;
  PAYMENT_RECEIPT_BASE_URL: string;
  ZARINPAL_MERCHANT_ID: string;
  ZARINPAL_SANDBOX: string;
  ZARINPAL_CALLBACK_URL: string;
  ZARINPAL_HTTP_TIMEOUT_MS: number;
  ZARINPAL_REQUEST_URL: string;
  ZARINPAL_VERIFY_URL: string;
  ZARINPAL_START_PAY_URL: string;

  NOTIFICATION_ENABLED: string;
  NOTIFICATION_EMAIL_ENABLED: string;
  EMAIL_ENABLED: string;
  MAIL_ENABLED: string;
  SMTP_HOST: string;
  EMAIL_SMTP_HOST: string;
  MAIL_HOST: string;
  SMTP_PORT: number;
  MAIL_PORT: number;
  SMTP_SECURE: string;
  MAIL_SECURE: string;
  SMTP_USER: string;
  MAIL_USER: string;
  SMTP_PASSWORD: string;
  MAIL_PASSWORD: string;
  SMTP_FROM_NAME: string;
  MAIL_FROM_NAME: string;
  NOTIFICATION_SENDER_NAME: string;
  SMTP_FROM_ADDRESS: string;
  EMAIL_FROM_ADDRESS: string;
  MAIL_FROM_EMAIL: string;
  NOTIFICATION_SENDER_EMAIL: string;
  NOTIFICATION_USER_EMAIL_COLUMN: string;
  NOTIFICATION_SMS_ENABLED: string;
  SMS_ENABLED: string;
  SMS_PROVIDER: string;
  SMS_PROVIDER_NAME: string;
  SMS_PROVIDER_URL: string;
  SMS_API_KEY: string;
  SMS_PROVIDER_TOKEN: string;
  SMS_PROVIDER_TOKEN_HEADER: string;
  SMS_PROVIDER_TOKEN_PREFIX: string;
  SMS_PROVIDER_RECIPIENT_FIELD: string;
  SMS_PROVIDER_MESSAGE_FIELD: string;
  SMS_PROVIDER_TEMPLATE_FIELD: string;
  SMS_PROVIDER_SENDER_FIELD: string;
  SMS_SENDER: string;
  SMS_HTTP_TIMEOUT_MS: number;
  NOTIFICATION_USER_PHONE_COLUMN: string;
  NOTIFICATION_PUSH_ENABLED: string;
  PUSH_ENABLED: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;

  AI_ENABLED: string;
  AI_PROVIDER: ValidAiProvider;
  AI_REQUEST_TIMEOUT_MS: number;
  HEALTH_REQUIRE_AI: string;
  AI_OLLAMA_THINK: ValidOllamaThinkMode;
  AI_OLLAMA_BASE_URL: string;
  OLLAMA_BASE_URL: string;
  AI_OLLAMA_DEFAULT_MODEL: string;
  OLLAMA_MODEL: string;
  AI_OLLAMA_PUBLIC_MODEL: string;
  AI_OLLAMA_CONSULTING_MODEL: string;
  AI_OLLAMA_SALES_MODEL: string;
  AI_OLLAMA_CONTENT_MODEL: string;
  AI_OLLAMA_SEO_MODEL: string;
  AI_OLLAMA_SMS_MODEL: string;
  AI_OLLAMA_BANNER_TEXT_MODEL: string;
  AI_OLLAMA_RECOMMENDATION_MODEL: string;
  AI_OLLAMA_COMPARISON_MODEL: string;
  AI_OLLAMA_EMBEDDING_MODEL: string;
  AI_OLLAMA_ANALYTICS_MODEL: string;
  AI_OLLAMA_MARKETING_STRATEGY_MODEL: string;
  AI_OLLAMA_DISCOUNT_MODEL: string;
  AI_OLLAMA_ADMIN_REPORT_MODEL: string;
  AI_OLLAMA_DEMAND_ANALYSIS_MODEL: string;
  AI_OLLAMA_VISION_MODEL: string;
  AI_OLLAMA_ALT_TEXT_MODEL: string;
  AI_OLLAMA_IMAGE_DESCRIPTION_MODEL: string;
  AI_OLLAMA_FALLBACK_MODEL: string;
  AI_OLLAMA_TIMEOUT_MS: number;
  OLLAMA_TIMEOUT_MS: number;
  AI_OLLAMA_KEEP_ALIVE: string;
  AI_OLLAMA_NUM_CTX: number;
  AI_OLLAMA_NUM_PREDICT: number;
  AI_OLLAMA_LONG_NUM_PREDICT: number;
  AI_OLLAMA_TEMPERATURE: number;
  AI_OLLAMA_PRECISE_TEMPERATURE: number;
  AI_OLLAMA_CREATIVE_TEMPERATURE: number;
  AI_RUNTIME_MAX_CONCURRENT: number;
  AI_RUNTIME_MAX_QUEUE_DEPTH: number;
  AI_RUNTIME_QUEUE_TIMEOUT_MS: number;
  AI_RERANKER_ENABLED: string;
  AI_RERANKER_BASE_URL: string;
  AI_RERANKER_TIMEOUT_MS: number;
  AI_RERANKER_MAX_LENGTH: number;
  AI_RERANKER_BATCH_SIZE: number;
  AI_RETRIEVAL_CANDIDATE_LIMIT: number;
  AI_RETRIEVAL_RERANK_LIMIT: number;
  AI_RETRIEVAL_EMBED_BATCH_SIZE: number;
  AI_RETRIEVAL_CACHE_MAX_ENTRIES: number;

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_ACCESS_TOKEN_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_REFRESH_TOKEN_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_DAYS: number;

  BCRYPT_SALT_ROUNDS: number;

  RATE_LIMIT_ENABLED: string;
  RATE_LIMIT_STORAGE_DRIVER: ValidRateLimitStorageDriver;
  RATE_LIMIT_REDIS_REQUIRED: string;
  RATE_LIMIT_TRUST_PROXY: string;
  RATE_LIMIT_KEY_PREFIX: string;
  RATE_LIMIT_DEFAULT_LIMIT: number;
  RATE_LIMIT_DEFAULT_TTL_MS: number;
  RATE_LIMIT_DEFAULT_BLOCK_MS: number;
  RATE_LIMIT_PUBLIC_LIMIT: number;
  RATE_LIMIT_PUBLIC_TTL_MS: number;
  RATE_LIMIT_PUBLIC_BLOCK_MS: number;
  RATE_LIMIT_AUTH_LIMIT: number;
  RATE_LIMIT_AUTH_TTL_MS: number;
  RATE_LIMIT_AUTH_BLOCK_MS: number;
  RATE_LIMIT_SENSITIVE_LIMIT: number;
  RATE_LIMIT_SENSITIVE_TTL_MS: number;
  RATE_LIMIT_SENSITIVE_BLOCK_MS: number;
  RATE_LIMIT_UPLOAD_LIMIT: number;
  RATE_LIMIT_UPLOAD_TTL_MS: number;
  RATE_LIMIT_UPLOAD_BLOCK_MS: number;
  RATE_LIMIT_SEARCH_LIMIT: number;
  RATE_LIMIT_SEARCH_TTL_MS: number;
  RATE_LIMIT_SEARCH_BLOCK_MS: number;
  RATE_LIMIT_ADMIN_LIMIT: number;
  RATE_LIMIT_ADMIN_TTL_MS: number;
  RATE_LIMIT_ADMIN_BLOCK_MS: number;
  RATE_LIMIT_SKIP_PATHS: string;

  QUEUE_ENABLED: string;
  QUEUE_REDIS_REQUIRED: string;
  QUEUE_PREFIX: string;
  QUEUE_DEFAULT_ATTEMPTS: number;
  QUEUE_DEFAULT_BACKOFF_DELAY_MS: number;
  QUEUE_DEFAULT_TIMEOUT_MS: number;
  QUEUE_REMOVE_ON_COMPLETE_COUNT: number;
  QUEUE_REMOVE_ON_FAIL_COUNT: number;
  QUEUE_WORKER_CONCURRENCY: number;
  QUEUE_STALLED_INTERVAL_MS: number;
  QUEUE_MAX_STALLED_COUNT: number;
  QUEUE_HEALTH_BACKLOG_WARNING_THRESHOLD: number;
  QUEUE_HEALTH_BACKLOG_CRITICAL_THRESHOLD: number;
  QUEUE_HEALTH_FAILED_WARNING_THRESHOLD: number;
  QUEUE_HEALTH_FAILED_CRITICAL_THRESHOLD: number;
  QUEUE_HEALTH_DELAYED_WARNING_THRESHOLD: number;
  QUEUE_HEALTH_DELAYED_CRITICAL_THRESHOLD: number;
  QUEUE_HEALTH_FAILURE_RATE_WARNING_PERCENT: number;
  QUEUE_HEALTH_FAILURE_RATE_CRITICAL_PERCENT: number;
  QUEUE_HEALTH_FAILURE_RATE_MIN_SAMPLE: number;
  QUEUE_REDIS_HOST: string;
  QUEUE_REDIS_PORT: number;
  QUEUE_REDIS_DB: number;
  QUEUE_REDIS_TLS: string;
  QUEUE_REDIS_CONNECT_TIMEOUT_MS: number;
  QUEUE_REDIS_MAX_RETRIES: number;

  SCHEDULER_ENABLED: string;
  SCHEDULER_TIMEZONE: string;
  SCHEDULER_MEDIA_CLEANUP_ENABLED: string;
  SCHEDULER_MEDIA_CLEANUP_CRON: string;
  SCHEDULER_MEDIA_CLEANUP_OLDER_THAN_MINUTES: number;
  SCHEDULER_MEDIA_CLEANUP_DRY_RUN: string;
  SCHEDULER_QUEUE_HEALTH_ENABLED: string;
  SCHEDULER_QUEUE_HEALTH_CRON: string;
  SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD: number;
}

const ALLOWED_NODE_ENVS: ValidNodeEnvironment[] = [
  'development',
  'test',
  'staging',
  'production',
];

const ALLOWED_RATE_LIMIT_STORAGE_DRIVERS: ValidRateLimitStorageDriver[] = [
  'memory',
  'redis',
];

const ALLOWED_MEDIA_STORAGE_DRIVERS: ValidMediaStorageDriver[] = [
  'local',
  'bunny',
];

const DEFAULT_DEV_ACCESS_SECRET =
  'development-access-secret-change-me-min-32-chars';

const DEFAULT_DEV_REFRESH_SECRET =
  'development-refresh-secret-change-me-min-32-chars';

function readString(
  config: RawEnv,
  keys: string[],
  fallback?: string,
): string | undefined {
  for (const key of keys) {
    const value = config[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return fallback;
}

function readStringAllowEmpty(
  config: RawEnv,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = config[key];

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return fallback;
}

function readNumber(
  config: RawEnv,
  keys: string[],
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  },
): number {
  const value = readString(config, keys);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options?.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options?.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return Math.floor(parsed);
}

function readBooleanAsString(
  config: RawEnv,
  keys: string[],
  fallback: boolean,
): string {
  const value = readString(config, keys);

  if (!value) {
    return String(fallback);
  }

  const normalized = value.toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return 'true';
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return 'false';
  }

  return String(fallback);
}

function readStrictBooleanAsString(
  config: RawEnv,
  keys: string[],
  fallback: boolean,
  label: string,
): string {
  const configuredValues = keys
    .map((key) => ({
      key,
      value: readString(config, [key]),
    }))
    .filter(
      (entry): entry is { key: string; value: string } =>
        entry.value !== undefined,
    );

  if (configuredValues.length === 0) {
    return String(fallback);
  }

  const normalizedValues = configuredValues.map(({ key, value }) => {
    const normalized = value.toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return {
        key,
        value: 'true',
      } as const;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return {
        key,
        value: 'false',
      } as const;
    }

    throw new Error(
      `Invalid boolean value for ${key}: "${value}". Expected true or false.`,
    );
  });

  const uniqueValues = [
    ...new Set(normalizedValues.map((entry) => entry.value)),
  ];

  if (uniqueValues.length > 1) {
    throw new Error(
      `Conflicting values for ${label}: ${normalizedValues
        .map((entry) => `${entry.key}=${entry.value}`)
        .join(', ')}`,
    );
  }

  return uniqueValues[0];
}

function readStrictNumber(
  config: RawEnv,
  keys: string[],
  fallback: number,
  options: {
    min: number;
    max: number;
    label: string;
  },
): number {
  const value = readString(config, keys);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < options.min ||
    parsed > options.max
  ) {
    throw new Error(
      `${options.label} must be an integer between ${options.min} and ${options.max}.`,
    );
  }

  return parsed;
}

function normalizeNodeEnv(value: string | undefined): ValidNodeEnvironment {
  const normalized = (value || 'development').toLowerCase();

  if (ALLOWED_NODE_ENVS.includes(normalized as ValidNodeEnvironment)) {
    return normalized as ValidNodeEnvironment;
  }

  throw new Error(
    `Invalid NODE_ENV "${value}". Allowed values: ${ALLOWED_NODE_ENVS.join(', ')}`,
  );
}

function isProductionLike(nodeEnv: ValidNodeEnvironment): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

function normalizeMediaStorageDriver(
  value: string | undefined,
  fallback: ValidMediaStorageDriver,
): ValidMediaStorageDriver {
  const normalized = (value || fallback).toLowerCase();

  if (
    ALLOWED_MEDIA_STORAGE_DRIVERS.includes(
      normalized as ValidMediaStorageDriver,
    )
  ) {
    return normalized as ValidMediaStorageDriver;
  }

  throw new Error(
    `Invalid MEDIA_STORAGE_DRIVER "${value}". Allowed values: ${ALLOWED_MEDIA_STORAGE_DRIVERS.join(', ')}`,
  );
}

function normalizeHttpUrl(
  value: string,
  key: string,
  options?: {
    required?: boolean;
    removeTrailingSlash?: boolean;
  },
): string {
  const normalized = value.trim();

  if (!normalized) {
    if (options?.required) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return '';
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${key} must be a valid HTTP or HTTPS URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${key} must use the HTTP or HTTPS protocol.`);
  }

  if (!parsed.hostname) {
    throw new Error(`${key} must include a hostname.`);
  }

  return options?.removeTrailingSlash
    ? normalized.replace(/\/+$/g, '')
    : normalized;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local') ||
    !normalized.includes('.') ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

function normalizePublicApplicationUrl(
  value: string,
  key: string,
  nodeEnv: ValidNodeEnvironment,
  options?: {
    required?: boolean;
  },
): string {
  const normalized = normalizeHttpUrl(value, key, {
    required: options?.required,
    removeTrailingSlash: true,
  });

  if (!normalized) {
    return '';
  }

  const parsed = new URL(normalized);

  if (parsed.username || parsed.password) {
    throw new Error(`${key} cannot include URL credentials.`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`${key} cannot include a query string or URL fragment.`);
  }

  if (isProductionLike(nodeEnv)) {
    if (parsed.protocol !== 'https:') {
      throw new Error(`${key} must use HTTPS in production/staging.`);
    }

    if (isPrivateOrLocalHostname(parsed.hostname)) {
      throw new Error(
        `${key} cannot use a private or local hostname in production/staging.`,
      );
    }
  }

  return normalized;
}

function normalizeMediaPublicBaseUrl(
  value: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error('MEDIA_PUBLIC_BASE_URL cannot be empty.');
  }

  if (normalized.startsWith('/')) {
    if (
      normalized.includes('\\') ||
      normalized.includes('?') ||
      normalized.includes('#')
    ) {
      throw new Error(
        'MEDIA_PUBLIC_BASE_URL path cannot include backslashes, a query string, or a URL fragment.',
      );
    }

    const path = `/${normalized.replace(/^\/+|\/+$/g, '')}`;

    if (path === '/') {
      throw new Error(
        'MEDIA_PUBLIC_BASE_URL cannot mount media at the application root.',
      );
    }

    return path;
  }

  return normalizePublicApplicationUrl(
    normalized,
    'MEDIA_PUBLIC_BASE_URL',
    nodeEnv,
    {
      required: true,
    },
  );
}

function validateBunnyStorageZone(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.charCodeAt(0);

    return codePoint < 32 || codePoint === 127;
  });

  if (
    normalized.length > 128 ||
    /[\s/\\?#]/u.test(normalized) ||
    hasControlCharacter
  ) {
    throw new Error(
      'BUNNY_STORAGE_ZONE_NAME must be a safe storage-zone identifier without whitespace, slashes, query characters, or control characters.',
    );
  }

  return normalized;
}

function validateBunnyStorageAccessKey(
  value: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  if (/\s/u.test(normalized) || normalized.length > 512) {
    throw new Error(
      'BUNNY_STORAGE_API_KEY must not contain whitespace and must be at most 512 characters.',
    );
  }

  if (
    isProductionLike(nodeEnv) &&
    (normalized.length < 16 ||
      normalized.toLowerCase().includes('change-me') ||
      normalized.toLowerCase().includes('placeholder'))
  ) {
    throw new Error(
      'BUNNY_STORAGE_API_KEY must be a non-placeholder key with at least 16 characters in production/staging.',
    );
  }

  return normalized;
}

function readConsistentStringAliases(
  config: RawEnv,
  keys: string[],
  fallback: string,
  label: string,
): string {
  const configuredValues = keys
    .map((key) => ({
      key,
      value: readString(config, [key]),
    }))
    .filter(
      (entry): entry is { key: string; value: string } =>
        entry.value !== undefined,
    );

  const uniqueValues = [
    ...new Set(configuredValues.map((entry) => entry.value)),
  ];

  if (uniqueValues.length > 1) {
    throw new Error(
      `Conflicting values for ${label}: ${configuredValues
        .map((entry) => `${entry.key}=${entry.value}`)
        .join(', ')}`,
    );
  }

  return uniqueValues[0] ?? fallback;
}

function readConsistentSecretAliases(
  config: RawEnv,
  keys: string[],
  fallback: string,
  label: string,
): string {
  const configuredValues = keys
    .map((key) => ({
      key,
      value: readString(config, [key]),
    }))
    .filter(
      (entry): entry is { key: string; value: string } =>
        entry.value !== undefined,
    );

  const uniqueValues = [
    ...new Set(configuredValues.map((entry) => entry.value)),
  ];

  if (uniqueValues.length > 1) {
    throw new Error(
      `Conflicting values for ${label}: ${configuredValues
        .map((entry) => entry.key)
        .join(', ')}`,
    );
  }

  return uniqueValues[0] ?? fallback;
}

function normalizePaymentGateway(
  value: string | undefined,
): ValidPaymentGateway {
  const normalized = (value || 'zarinpal').trim().toLowerCase();

  if (normalized === 'zarinpal') {
    return 'zarinpal';
  }

  throw new Error(
    `Invalid PAYMENT_GATEWAY "${value}". Allowed value: zarinpal`,
  );
}

function normalizePaymentCurrency(
  value: string | undefined,
): ValidPaymentCurrency {
  const normalized = (value || 'IRR').trim().toUpperCase();

  if (normalized === 'IRR') {
    return 'IRR';
  }

  throw new Error(
    `Invalid DEFAULT_CURRENCY "${value}". Storefront checkout requires IRR.`,
  );
}

function normalizePaymentUrl(
  value: string,
  key: string,
  nodeEnv: ValidNodeEnvironment,
  options?: {
    required?: boolean;
    removeTrailingSlash?: boolean;
  },
): string {
  const normalized = normalizeHttpUrl(value, key, options);

  if (!normalized) {
    return '';
  }

  const parsed = new URL(normalized);

  if (parsed.username || parsed.password) {
    throw new Error(`${key} cannot include URL credentials.`);
  }

  if (parsed.hash) {
    throw new Error(`${key} cannot include a URL fragment.`);
  }

  if (isProductionLike(nodeEnv)) {
    if (parsed.protocol !== 'https:') {
      throw new Error(`${key} must use HTTPS in production/staging.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    ) {
      throw new Error(
        `${key} cannot use a local hostname in production/staging.`,
      );
    }
  }

  return normalized;
}

function assertSameOrigin(
  value: string,
  expectedOriginUrl: string,
  key: string,
): string {
  const actual = new URL(value);
  const expected = new URL(expectedOriginUrl);

  if (actual.origin !== expected.origin) {
    throw new Error(
      `${key} must use the same origin as FRONTEND_URL (${expected.origin}).`,
    );
  }

  return value;
}

function normalizeEmailAddress(
  value: string,
  key: string,
  options?: {
    required?: boolean;
  },
): string {
  const normalized = value.trim();

  if (!normalized) {
    if (options?.required) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return '';
  }

  if (/\r|\n/.test(normalized)) {
    throw new Error(`${key} cannot contain line breaks.`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${key} must be a valid email address.`);
  }

  return normalized;
}

function normalizeSmtpHost(value: string, key: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  if (
    normalized.includes('://') ||
    /[\s/@?#\\]/.test(normalized) ||
    /\r|\n/.test(normalized)
  ) {
    throw new Error(
      `${key} must contain only a hostname or IP address without protocol or port.`,
    );
  }

  return normalized;
}

function normalizeSafeIdentifier(
  value: string,
  key: string,
  fallback: string,
): string {
  const normalized = value.trim() || fallback;

  if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(normalized)) {
    throw new Error(
      `${key} must be a safe identifier containing letters, numbers, underscore, dot, or hyphen.`,
    );
  }

  if (['__proto__', 'prototype', 'constructor'].includes(normalized)) {
    throw new Error(`${key} uses a reserved identifier.`);
  }

  return normalized;
}

function normalizeHttpHeaderName(value: string, key: string): string {
  const normalized = value.trim();

  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(normalized)) {
    throw new Error(`${key} must be a valid HTTP header name.`);
  }

  return normalized;
}

function normalizeHeaderValue(value: string, key: string): string {
  const normalized = value.trim();

  if (/\r|\n/.test(normalized)) {
    throw new Error(`${key} cannot contain line breaks.`);
  }

  return normalized;
}

function normalizeExternalServiceUrl(
  value: string,
  key: string,
  nodeEnv: ValidNodeEnvironment,
  options?: {
    required?: boolean;
  },
): string {
  const normalized = normalizeHttpUrl(value, key, {
    required: options?.required,
  });

  if (!normalized) {
    return '';
  }

  const parsed = new URL(normalized);

  if (parsed.username || parsed.password) {
    throw new Error(`${key} cannot include URL credentials.`);
  }

  if (parsed.hash) {
    throw new Error(`${key} cannot include a URL fragment.`);
  }

  if (isProductionLike(nodeEnv)) {
    if (parsed.protocol !== 'https:') {
      throw new Error(`${key} must use HTTPS in production/staging.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    ) {
      throw new Error(
        `${key} cannot use a local hostname in production/staging.`,
      );
    }
  }

  return normalized;
}

function normalizeVapidKey(
  value: string,
  key: string,
  minimumLength: number,
): string {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  if (
    normalized.length < minimumLength ||
    normalized.length > 160 ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(normalized)
  ) {
    throw new Error(`${key} is not a valid URL-safe VAPID key.`);
  }

  return normalized;
}

function normalizeVapidSubject(
  value: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('mailto:')) {
    const address = normalizeEmailAddress(
      normalized.slice('mailto:'.length),
      'VAPID_SUBJECT',
      {
        required: true,
      },
    );

    if (isProductionLike(nodeEnv) && address.toLowerCase().endsWith('.local')) {
      throw new Error(
        'VAPID_SUBJECT cannot use a .local email address in production/staging.',
      );
    }

    return `mailto:${address}`;
  }

  const subjectUrl = normalizeExternalServiceUrl(
    normalized,
    'VAPID_SUBJECT',
    nodeEnv,
    {
      required: true,
    },
  );

  if (new URL(subjectUrl).protocol !== 'https:') {
    throw new Error('VAPID_SUBJECT must use mailto: or an HTTPS URL.');
  }

  return subjectUrl;
}

function normalizeAiProvider(value: string | undefined): ValidAiProvider {
  const normalized = (value || 'ollama').trim().toLowerCase();

  if (normalized === 'ollama') {
    return 'ollama';
  }

  throw new Error(`Invalid AI_PROVIDER "${value}". Allowed value: ollama`);
}

function normalizeOllamaBaseUrl(
  value: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const normalized = normalizeHttpUrl(value, 'AI_OLLAMA_BASE_URL', {
    required: true,
    removeTrailingSlash: true,
  });

  const parsed = new URL(normalized);

  if (parsed.username || parsed.password) {
    throw new Error('AI_OLLAMA_BASE_URL cannot include URL credentials.');
  }

  if (parsed.search || parsed.hash) {
    throw new Error(
      'AI_OLLAMA_BASE_URL cannot include a query string or URL fragment.',
    );
  }

  if (isProductionLike(nodeEnv) && parsed.protocol === 'http:') {
    const hostname = parsed.hostname.toLowerCase();
    const isPrivateOrLocal =
      hostname === 'host.docker.internal' ||
      hostname === 'reranker' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

    if (!isPrivateOrLocal) {
      throw new Error(
        'AI_OLLAMA_BASE_URL must use HTTPS for a public host in production/staging.',
      );
    }
  }

  return normalized;
}

function normalizeOllamaModel(value: string, key: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${key} cannot be empty.`);
  }

  if (
    normalized.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(
      normalized,
    )
  ) {
    throw new Error(`${key} is not a valid Ollama model reference.`);
  }

  return normalized;
}

function normalizeOllamaThinkMode(config: RawEnv): ValidOllamaThinkMode {
  const raw = readString(config, ['AI_OLLAMA_THINK'], 'false')!;
  const normalized = raw.trim().toLowerCase();

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return 'false';
  }

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return 'true';
  }

  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized as ValidOllamaThinkMode;
  }

  throw new Error('AI_OLLAMA_THINK must be false, true, low, medium, or high.');
}

function readStrictDecimal(
  config: RawEnv,
  keys: string[],
  fallback: number,
  options: {
    min: number;
    max: number;
    label: string;
  },
): number {
  const value = readString(config, keys);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < options.min ||
    parsed > options.max
  ) {
    throw new Error(
      `${options.label} must be a number between ${options.min} and ${options.max}.`,
    );
  }

  return parsed;
}

function normalizeRateLimitStorageDriver(
  value: string | undefined,
): ValidRateLimitStorageDriver {
  const normalized = (value || 'memory').toLowerCase();

  if (
    ALLOWED_RATE_LIMIT_STORAGE_DRIVERS.includes(
      normalized as ValidRateLimitStorageDriver,
    )
  ) {
    return normalized as ValidRateLimitStorageDriver;
  }

  throw new Error(
    `Invalid RATE_LIMIT_STORAGE_DRIVER "${value}". Allowed values: ${ALLOWED_RATE_LIMIT_STORAGE_DRIVERS.join(', ')}`,
  );
}

function normalizeApiPrefix(value: string | undefined): string {
  return (value || 'api').replace(/^\/+|\/+$/g, '');
}

function normalizeCorsOrigins(
  value: string | undefined,
  frontendUrl: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const fallbackOrigin = new URL(frontendUrl).origin;
  const rawValue = value?.trim() || fallbackOrigin;

  const origins = rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const uniqueOrigins = [...new Set(origins)];

  if (uniqueOrigins.length === 0) {
    if (isProductionLike(nodeEnv)) {
      throw new Error(
        'CORS_ORIGINS or FRONTEND_URL is required in production/staging.',
      );
    }

    return 'http://localhost:3000';
  }

  const normalizedOrigins = uniqueOrigins.map((origin) => {
    if (origin === '*') {
      if (isProductionLike(nodeEnv)) {
        throw new Error('CORS_ORIGINS cannot be "*" in production/staging.');
      }

      return origin;
    }

    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`CORS origin must use HTTP or HTTPS: ${origin}`);
    }

    if (parsed.username || parsed.password) {
      throw new Error(`CORS origin cannot include credentials: ${origin}`);
    }

    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(
        `CORS origin must not include a path, query, or fragment: ${origin}`,
      );
    }

    if (isProductionLike(nodeEnv)) {
      if (parsed.protocol !== 'https:') {
        throw new Error(
          `CORS origin must use HTTPS in production/staging: ${origin}`,
        );
      }

      if (isPrivateOrLocalHostname(parsed.hostname)) {
        throw new Error(
          `CORS origin cannot use a private or local hostname in production/staging: ${origin}`,
        );
      }
    }

    return parsed.origin;
  });

  return normalizedOrigins.join(',');
}

function normalizeCronExpression(
  value: string | undefined,
  fallback: string,
): string {
  const cron = value?.trim() || fallback;
  const parts = cron.split(/\s+/).filter(Boolean);

  if (parts.length !== 5 && parts.length !== 6) {
    return fallback;
  }

  return cron;
}

function requireValue(value: string | undefined, key: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

function normalizeDatabaseUrl(value: string | undefined): string {
  const normalized = requireValue(value, 'DATABASE_URL');

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(
      'DATABASE_URL must use the postgres or postgresql protocol.',
    );
  }

  if (!parsed.hostname) {
    throw new Error('DATABASE_URL must include a database hostname.');
  }

  if (!parsed.pathname || parsed.pathname === '/') {
    throw new Error('DATABASE_URL must include a database name.');
  }

  if (parsed.hash) {
    throw new Error('DATABASE_URL cannot include a URL fragment.');
  }

  return normalized;
}

function normalizeDatabaseApplicationName(value: string | undefined): string {
  const normalized = (value ?? 'vexo-beauty-backend').trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,62}$/.test(normalized)) {
    throw new Error(
      'DATABASE_APPLICATION_NAME must be 1-63 characters and contain only letters, numbers, dot, underscore, colon, or hyphen.',
    );
  }

  return normalized;
}

function validateSecret(
  value: string,
  key: string,
  nodeEnv: ValidNodeEnvironment,
): string {
  const normalized = requireValue(value, key);

  if (isProductionLike(nodeEnv)) {
    if (normalized.length < 32) {
      throw new Error(
        `${key} must be at least 32 characters in production/staging.`,
      );
    }

    if (
      normalized === DEFAULT_DEV_ACCESS_SECRET ||
      normalized === DEFAULT_DEV_REFRESH_SECRET ||
      normalized.includes('change-me')
    ) {
      throw new Error(`${key} cannot use a development placeholder value.`);
    }
  }

  return normalized;
}

function parseRefreshExpiresDays(value: string): number {
  const normalized = value.trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const match = normalized.match(/^(\d+)\s*d$/);

  if (match) {
    return Number(match[1]);
  }

  return 30;
}

function syncProcessEnv(key: string, value: string | number): void {
  process.env[key] = String(value);
}

function syncMany(values: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(values)) {
    syncProcessEnv(key, value);
  }
}

export function validateEnv(config: RawEnv): ValidatedEnv {
  const nodeEnv = normalizeNodeEnv(
    readString(config, ['NODE_ENV'], 'development'),
  );

  const port = readNumber(config, ['PORT'], 3000, {
    min: 1,
    max: 65_535,
  });

  const databaseUrl = normalizeDatabaseUrl(
    readString(config, ['DATABASE_URL']),
  );
  const databaseLogQueries = readStrictBooleanAsString(
    config,
    ['DATABASE_LOG_QUERIES'],
    false,
    'database query logging',
  );
  const databaseConnectionTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_CONNECTION_TIMEOUT_MS'],
    10_000,
    {
      min: 1_000,
      max: 60_000,
      label: 'DATABASE_CONNECTION_TIMEOUT_MS',
    },
  );
  const databaseStatementTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_STATEMENT_TIMEOUT_MS'],
    30_000,
    {
      min: 1_000,
      max: 300_000,
      label: 'DATABASE_STATEMENT_TIMEOUT_MS',
    },
  );
  const databaseQueryTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_QUERY_TIMEOUT_MS'],
    30_000,
    {
      min: 1_000,
      max: 300_000,
      label: 'DATABASE_QUERY_TIMEOUT_MS',
    },
  );
  const databaseIdleTransactionTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_IDLE_TRANSACTION_TIMEOUT_MS'],
    60_000,
    {
      min: 1_000,
      max: 900_000,
      label: 'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS',
    },
  );
  const databaseTransactionTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_TRANSACTION_TIMEOUT_MS'],
    15_000,
    {
      min: 1_000,
      max: 300_000,
      label: 'DATABASE_TRANSACTION_TIMEOUT_MS',
    },
  );
  const databaseMaxWaitMs = readStrictNumber(
    config,
    ['DATABASE_MAX_WAIT_MS'],
    5_000,
    {
      min: 100,
      max: 60_000,
      label: 'DATABASE_MAX_WAIT_MS',
    },
  );
  const databasePoolMin = readStrictNumber(config, ['DATABASE_POOL_MIN'], 0, {
    min: 0,
    max: 50,
    label: 'DATABASE_POOL_MIN',
  });
  const databasePoolMax = readStrictNumber(config, ['DATABASE_POOL_MAX'], 10, {
    min: 1,
    max: 100,
    label: 'DATABASE_POOL_MAX',
  });

  if (databasePoolMin > databasePoolMax) {
    throw new Error(
      'DATABASE_POOL_MIN cannot be greater than DATABASE_POOL_MAX.',
    );
  }

  const databasePoolIdleTimeoutMs = readStrictNumber(
    config,
    ['DATABASE_POOL_IDLE_TIMEOUT_MS'],
    30_000,
    {
      min: 1_000,
      max: 300_000,
      label: 'DATABASE_POOL_IDLE_TIMEOUT_MS',
    },
  );
  const databasePoolMaxLifetimeSeconds = readStrictNumber(
    config,
    ['DATABASE_POOL_MAX_LIFETIME_SECONDS'],
    1_800,
    {
      min: 0,
      max: 86_400,
      label: 'DATABASE_POOL_MAX_LIFETIME_SECONDS',
    },
  );
  const databaseApplicationName = normalizeDatabaseApplicationName(
    readString(config, ['DATABASE_APPLICATION_NAME']),
  );
  const databaseMigrationsRequired = readStrictBooleanAsString(
    config,
    ['DATABASE_MIGRATIONS_REQUIRED'],
    isProductionLike(nodeEnv),
    'database migration readiness',
  );

  const jwtAccessSecret = validateSecret(
    readString(
      config,
      ['JWT_ACCESS_SECRET', 'JWT_ACCESS_TOKEN_SECRET', 'JWT_SECRET'],
      isProductionLike(nodeEnv) ? undefined : DEFAULT_DEV_ACCESS_SECRET,
    ) || '',
    'JWT_ACCESS_SECRET',
    nodeEnv,
  );

  const jwtRefreshSecret = validateSecret(
    readString(
      config,
      ['JWT_REFRESH_SECRET', 'JWT_REFRESH_TOKEN_SECRET'],
      isProductionLike(nodeEnv) ? undefined : DEFAULT_DEV_REFRESH_SECRET,
    ) || '',
    'JWT_REFRESH_SECRET',
    nodeEnv,
  );

  const appName = readString(config, ['APP_NAME'], 'VEXO Beauty Backend')!;
  const appVersion = readString(config, ['APP_VERSION'], '1.0.0')!;
  const host = readString(config, ['HOST'], '0.0.0.0')!;
  const appUrl = normalizePublicApplicationUrl(
    readString(
      config,
      ['APP_URL'],
      isProductionLike(nodeEnv) ? '' : `http://localhost:${port}`,
    ) ?? '',
    'APP_URL',
    nodeEnv,
    {
      required: isProductionLike(nodeEnv),
    },
  );

  const frontendUrl = normalizePublicApplicationUrl(
    readString(
      config,
      ['FRONTEND_URL'],
      isProductionLike(nodeEnv) ? '' : 'http://localhost:3000',
    ) ?? '',
    'FRONTEND_URL',
    nodeEnv,
    {
      required: isProductionLike(nodeEnv),
    },
  );

  const apiPrefix = normalizeApiPrefix(
    readString(config, ['API_PREFIX'], 'api'),
  );

  const defaultCurrency = normalizePaymentCurrency(
    readString(config, ['DEFAULT_CURRENCY'], 'IRR'),
  );

  const paymentGateway = normalizePaymentGateway(
    readString(config, ['PAYMENT_GATEWAY'], 'zarinpal'),
  );

  const paymentSandbox = readStrictBooleanAsString(
    config,
    ['PAYMENT_SANDBOX', 'ZARINPAL_SANDBOX'],
    nodeEnv !== 'production',
    'Payment sandbox mode',
  );

  if (nodeEnv === 'production' && paymentSandbox === 'true') {
    throw new Error('ZARINPAL_SANDBOX cannot be enabled in production.');
  }

  const zarinpalMerchantId =
    readString(config, ['ZARINPAL_MERCHANT_ID'], '') ?? '';

  if (isProductionLike(nodeEnv) && zarinpalMerchantId.length === 0) {
    throw new Error(
      'Missing required environment variable: ZARINPAL_MERCHANT_ID',
    );
  }

  const paymentCallbackUrl = normalizePaymentUrl(
    readConsistentStringAliases(
      config,
      ['PAYMENT_CALLBACK_URL', 'ZARINPAL_CALLBACK_URL'],
      '',
      'Zarinpal callback URL',
    ),
    'ZARINPAL_CALLBACK_URL',
    nodeEnv,
    {
      required: isProductionLike(nodeEnv),
    },
  );

  const paymentSuccessRedirectUrl = assertSameOrigin(
    normalizePaymentUrl(
      readString(
        config,
        ['PAYMENT_SUCCESS_REDIRECT_URL'],
        `${frontendUrl.replace(/\/+$/g, '')}/payment/success`,
      )!,
      'PAYMENT_SUCCESS_REDIRECT_URL',
      nodeEnv,
      {
        required: true,
      },
    ),
    frontendUrl,
    'PAYMENT_SUCCESS_REDIRECT_URL',
  );

  const paymentFailureRedirectUrl = assertSameOrigin(
    normalizePaymentUrl(
      readString(
        config,
        ['PAYMENT_FAILURE_REDIRECT_URL'],
        `${frontendUrl.replace(/\/+$/g, '')}/payment/failure`,
      )!,
      'PAYMENT_FAILURE_REDIRECT_URL',
      nodeEnv,
      {
        required: true,
      },
    ),
    frontendUrl,
    'PAYMENT_FAILURE_REDIRECT_URL',
  );

  const paymentReceiptBaseUrl = normalizePaymentUrl(
    readString(config, ['PAYMENT_RECEIPT_BASE_URL'], '') ?? '',
    'PAYMENT_RECEIPT_BASE_URL',
    nodeEnv,
    {
      removeTrailingSlash: true,
    },
  );

  const zarinpalHttpTimeoutMs = readStrictNumber(
    config,
    ['ZARINPAL_HTTP_TIMEOUT_MS'],
    15_000,
    {
      min: 1_000,
      max: 120_000,
      label: 'ZARINPAL_HTTP_TIMEOUT_MS',
    },
  );

  const zarinpalRequestUrl = normalizePaymentUrl(
    readString(
      config,
      ['ZARINPAL_REQUEST_URL'],
      paymentSandbox === 'true'
        ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
        : 'https://payment.zarinpal.com/pg/v4/payment/request.json',
    )!,
    'ZARINPAL_REQUEST_URL',
    nodeEnv,
    {
      required: true,
    },
  );

  const zarinpalVerifyUrl = normalizePaymentUrl(
    readString(
      config,
      ['ZARINPAL_VERIFY_URL'],
      paymentSandbox === 'true'
        ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
        : 'https://payment.zarinpal.com/pg/v4/payment/verify.json',
    )!,
    'ZARINPAL_VERIFY_URL',
    nodeEnv,
    {
      required: true,
    },
  );

  const zarinpalStartPayUrl = normalizePaymentUrl(
    readString(
      config,
      ['ZARINPAL_START_PAY_URL'],
      paymentSandbox === 'true'
        ? 'https://sandbox.zarinpal.com/pg/StartPay'
        : 'https://payment.zarinpal.com/pg/StartPay',
    )!,
    'ZARINPAL_START_PAY_URL',
    nodeEnv,
    {
      required: true,
      removeTrailingSlash: true,
    },
  );

  const notificationEnabled = readStrictBooleanAsString(
    config,
    ['NOTIFICATION_ENABLED'],
    true,
    'notification enabled state',
  );

  const emailEnabled = readStrictBooleanAsString(
    config,
    ['NOTIFICATION_EMAIL_ENABLED', 'EMAIL_ENABLED', 'MAIL_ENABLED'],
    false,
    'email notification enabled state',
  );

  const smsEnabled = readStrictBooleanAsString(
    config,
    ['NOTIFICATION_SMS_ENABLED', 'SMS_ENABLED'],
    false,
    'SMS notification enabled state',
  );

  const pushEnabled = readStrictBooleanAsString(
    config,
    ['NOTIFICATION_PUSH_ENABLED', 'PUSH_ENABLED'],
    false,
    'push notification enabled state',
  );

  if (
    notificationEnabled === 'false' &&
    [emailEnabled, smsEnabled, pushEnabled].includes('true')
  ) {
    throw new Error(
      'External notification channels cannot be enabled when NOTIFICATION_ENABLED=false.',
    );
  }

  const smtpHost = normalizeSmtpHost(
    readConsistentStringAliases(
      config,
      ['SMTP_HOST', 'EMAIL_SMTP_HOST', 'MAIL_HOST'],
      '',
      'SMTP host',
    ),
    'SMTP_HOST',
  );

  const smtpPort = readStrictNumber(config, ['SMTP_PORT', 'MAIL_PORT'], 587, {
    min: 1,
    max: 65_535,
    label: 'SMTP_PORT',
  });

  const smtpSecure = readStrictBooleanAsString(
    config,
    ['SMTP_SECURE', 'MAIL_SECURE'],
    false,
    'SMTP secure state',
  );

  const smtpUser = readConsistentStringAliases(
    config,
    ['SMTP_USER', 'MAIL_USER'],
    '',
    'SMTP user',
  );

  const smtpPassword = readConsistentSecretAliases(
    config,
    ['SMTP_PASSWORD', 'MAIL_PASSWORD'],
    '',
    'SMTP password aliases',
  );

  if (smtpUser.length > 0 !== smtpPassword.length > 0) {
    throw new Error(
      'SMTP_USER and SMTP_PASSWORD must either both be configured or both be empty.',
    );
  }

  const smtpFromName = normalizeHeaderValue(
    readConsistentStringAliases(
      config,
      ['SMTP_FROM_NAME', 'MAIL_FROM_NAME', 'NOTIFICATION_SENDER_NAME'],
      'VEXO Beauty',
      'SMTP sender name',
    ),
    'SMTP_FROM_NAME',
  );

  const smtpFromAddress = normalizeEmailAddress(
    readConsistentStringAliases(
      config,
      [
        'SMTP_FROM_ADDRESS',
        'EMAIL_FROM_ADDRESS',
        'MAIL_FROM_EMAIL',
        'NOTIFICATION_SENDER_EMAIL',
      ],
      '',
      'SMTP sender address',
    ),
    'SMTP_FROM_ADDRESS',
    {
      required: emailEnabled === 'true',
    },
  );

  if (emailEnabled === 'true' && !smtpHost) {
    throw new Error('Missing required environment variable: SMTP_HOST');
  }

  const notificationUserEmailColumn = normalizeSafeIdentifier(
    readString(config, ['NOTIFICATION_USER_EMAIL_COLUMN'], 'email')!,
    'NOTIFICATION_USER_EMAIL_COLUMN',
    'email',
  );

  const smsProvider = normalizeSafeIdentifier(
    readConsistentStringAliases(
      config,
      ['SMS_PROVIDER', 'SMS_PROVIDER_NAME'],
      'generic-http',
      'SMS provider name',
    ),
    'SMS_PROVIDER_NAME',
    'generic-http',
  );

  const smsProviderUrl = normalizeExternalServiceUrl(
    readString(config, ['SMS_PROVIDER_URL'], '') ?? '',
    'SMS_PROVIDER_URL',
    nodeEnv,
    {
      required: smsEnabled === 'true',
    },
  );

  const smsProviderToken = readConsistentSecretAliases(
    config,
    ['SMS_PROVIDER_TOKEN', 'SMS_API_KEY'],
    '',
    'SMS provider token aliases',
  );

  const smsProviderTokenHeader = normalizeHttpHeaderName(
    readString(config, ['SMS_PROVIDER_TOKEN_HEADER'], 'Authorization')!,
    'SMS_PROVIDER_TOKEN_HEADER',
  );

  const smsProviderTokenPrefix = normalizeHeaderValue(
    readStringAllowEmpty(config, ['SMS_PROVIDER_TOKEN_PREFIX'], 'Bearer'),
    'SMS_PROVIDER_TOKEN_PREFIX',
  );

  const smsProviderRecipientField = normalizeSafeIdentifier(
    readString(config, ['SMS_PROVIDER_RECIPIENT_FIELD'], 'to')!,
    'SMS_PROVIDER_RECIPIENT_FIELD',
    'to',
  );

  const smsProviderMessageField = normalizeSafeIdentifier(
    readString(config, ['SMS_PROVIDER_MESSAGE_FIELD'], 'message')!,
    'SMS_PROVIDER_MESSAGE_FIELD',
    'message',
  );

  const smsProviderTemplateField = normalizeSafeIdentifier(
    readString(config, ['SMS_PROVIDER_TEMPLATE_FIELD'], 'template')!,
    'SMS_PROVIDER_TEMPLATE_FIELD',
    'template',
  );

  const smsProviderSenderField = normalizeSafeIdentifier(
    readString(config, ['SMS_PROVIDER_SENDER_FIELD'], 'sender')!,
    'SMS_PROVIDER_SENDER_FIELD',
    'sender',
  );

  const smsSender = normalizeHeaderValue(
    readString(config, ['SMS_SENDER'], '') ?? '',
    'SMS_SENDER',
  );

  const smsHttpTimeoutMs = readStrictNumber(
    config,
    ['SMS_HTTP_TIMEOUT_MS'],
    10_000,
    {
      min: 1_000,
      max: 120_000,
      label: 'SMS_HTTP_TIMEOUT_MS',
    },
  );

  const notificationUserPhoneColumn = normalizeSafeIdentifier(
    readString(config, ['NOTIFICATION_USER_PHONE_COLUMN'], 'phone')!,
    'NOTIFICATION_USER_PHONE_COLUMN',
    'phone',
  );

  const vapidPublicKey = normalizeVapidKey(
    readString(config, ['VAPID_PUBLIC_KEY'], '') ?? '',
    'VAPID_PUBLIC_KEY',
    80,
  );

  const vapidPrivateKey = normalizeVapidKey(
    readString(config, ['VAPID_PRIVATE_KEY'], '') ?? '',
    'VAPID_PRIVATE_KEY',
    40,
  );

  const vapidSubject = normalizeVapidSubject(
    readString(
      config,
      ['VAPID_SUBJECT'],
      isProductionLike(nodeEnv) ? '' : 'mailto:no-reply@vexo-beauty.local',
    ) ?? '',
    nodeEnv,
  );

  if (pushEnabled === 'true') {
    const missingPushVariables = [
      vapidPublicKey ? null : 'VAPID_PUBLIC_KEY',
      vapidPrivateKey ? null : 'VAPID_PRIVATE_KEY',
      vapidSubject ? null : 'VAPID_SUBJECT',
    ].filter((value): value is string => value !== null);

    if (missingPushVariables.length > 0) {
      throw new Error(
        `Missing required Web Push environment variables: ${missingPushVariables.join(', ')}`,
      );
    }
  }

  const aiEnabled = readStrictBooleanAsString(
    config,
    ['AI_ENABLED'],
    true,
    'AI enabled state',
  );

  const aiProvider = normalizeAiProvider(
    readString(config, ['AI_PROVIDER'], 'ollama'),
  );

  const healthRequireAi = readStrictBooleanAsString(
    config,
    ['HEALTH_REQUIRE_AI'],
    false,
    'AI health requirement state',
  );

  if (aiEnabled === 'false' && healthRequireAi === 'true') {
    throw new Error(
      'HEALTH_REQUIRE_AI cannot be enabled when AI_ENABLED=false.',
    );
  }

  const aiRequestTimeoutMs = readStrictNumber(
    config,
    ['AI_REQUEST_TIMEOUT_MS'],
    240_000,
    {
      min: 1_000,
      max: 900_000,
      label: 'AI_REQUEST_TIMEOUT_MS',
    },
  );

  const ollamaBaseUrl = normalizeOllamaBaseUrl(
    readConsistentStringAliases(
      config,
      ['AI_OLLAMA_BASE_URL', 'OLLAMA_BASE_URL'],
      'http://127.0.0.1:11434',
      'Ollama base URL',
    ),
    nodeEnv,
  );

  const ollamaDefaultModel = normalizeOllamaModel(
    readConsistentStringAliases(
      config,
      ['AI_OLLAMA_DEFAULT_MODEL', 'OLLAMA_MODEL'],
      'qwen3.5:9b',
      'Ollama default model',
    ),
    'AI_OLLAMA_DEFAULT_MODEL',
  );

  const readAiModel = (key: string, fallback: string): string =>
    normalizeOllamaModel(readString(config, [key], fallback)!, key);

  const ollamaPublicModel = readAiModel(
    'AI_OLLAMA_PUBLIC_MODEL',
    ollamaDefaultModel,
  );
  const ollamaConsultingModel = readAiModel(
    'AI_OLLAMA_CONSULTING_MODEL',
    ollamaDefaultModel,
  );
  const ollamaSalesModel = readAiModel(
    'AI_OLLAMA_SALES_MODEL',
    ollamaDefaultModel,
  );
  const ollamaContentModel = readAiModel(
    'AI_OLLAMA_CONTENT_MODEL',
    ollamaDefaultModel,
  );
  const ollamaSeoModel = readAiModel('AI_OLLAMA_SEO_MODEL', ollamaDefaultModel);
  const ollamaSmsModel = readAiModel('AI_OLLAMA_SMS_MODEL', ollamaDefaultModel);
  const ollamaBannerTextModel = readAiModel(
    'AI_OLLAMA_BANNER_TEXT_MODEL',
    ollamaDefaultModel,
  );
  const ollamaRecommendationModel = readAiModel(
    'AI_OLLAMA_RECOMMENDATION_MODEL',
    ollamaDefaultModel,
  );
  const ollamaComparisonModel = readAiModel(
    'AI_OLLAMA_COMPARISON_MODEL',
    ollamaDefaultModel,
  );
  const ollamaEmbeddingModel = readAiModel(
    'AI_OLLAMA_EMBEDDING_MODEL',
    'qwen3-embedding:4b',
  );
  const ollamaAnalyticsModel = readAiModel(
    'AI_OLLAMA_ANALYTICS_MODEL',
    'deepseek-r1:14b',
  );
  const ollamaMarketingStrategyModel = readAiModel(
    'AI_OLLAMA_MARKETING_STRATEGY_MODEL',
    'deepseek-r1:14b',
  );
  const ollamaDiscountModel = readAiModel(
    'AI_OLLAMA_DISCOUNT_MODEL',
    'deepseek-r1:14b',
  );
  const ollamaAdminReportModel = readAiModel(
    'AI_OLLAMA_ADMIN_REPORT_MODEL',
    'deepseek-r1:14b',
  );
  const ollamaDemandAnalysisModel = readAiModel(
    'AI_OLLAMA_DEMAND_ANALYSIS_MODEL',
    'deepseek-r1:14b',
  );
  const ollamaVisionModel = readAiModel('AI_OLLAMA_VISION_MODEL', 'gemma4:12b');
  const ollamaAltTextModel = readAiModel(
    'AI_OLLAMA_ALT_TEXT_MODEL',
    ollamaVisionModel,
  );
  const ollamaImageDescriptionModel = readAiModel(
    'AI_OLLAMA_IMAGE_DESCRIPTION_MODEL',
    ollamaVisionModel,
  );
  const ollamaFallbackModel = readAiModel(
    'AI_OLLAMA_FALLBACK_MODEL',
    'llama3.1:8b',
  );

  const ollamaTimeoutMs = readStrictNumber(
    {
      ...config,
      AI_OLLAMA_TIMEOUT_MS: readConsistentStringAliases(
        config,
        ['AI_OLLAMA_TIMEOUT_MS', 'OLLAMA_TIMEOUT_MS'],
        '180000',
        'Ollama timeout',
      ),
    },
    ['AI_OLLAMA_TIMEOUT_MS'],
    180_000,
    {
      min: 1_000,
      max: 900_000,
      label: 'AI_OLLAMA_TIMEOUT_MS',
    },
  );

  const ollamaThink = normalizeOllamaThinkMode(config);
  const ollamaKeepAlive = normalizeHeaderValue(
    readString(config, ['AI_OLLAMA_KEEP_ALIVE'], '30m')!,
    'AI_OLLAMA_KEEP_ALIVE',
  );

  if (!ollamaKeepAlive || ollamaKeepAlive.length > 64) {
    throw new Error(
      'AI_OLLAMA_KEEP_ALIVE must contain between 1 and 64 characters.',
    );
  }

  const ollamaNumCtx = readStrictNumber(config, ['AI_OLLAMA_NUM_CTX'], 4096, {
    min: 512,
    max: 131_072,
    label: 'AI_OLLAMA_NUM_CTX',
  });

  const ollamaNumPredict = readStrictNumber(
    config,
    ['AI_OLLAMA_NUM_PREDICT'],
    256,
    {
      min: 64,
      max: 8192,
      label: 'AI_OLLAMA_NUM_PREDICT',
    },
  );

  const ollamaLongNumPredict = readStrictNumber(
    config,
    ['AI_OLLAMA_LONG_NUM_PREDICT'],
    2048,
    {
      min: 128,
      max: 8192,
      label: 'AI_OLLAMA_LONG_NUM_PREDICT',
    },
  );

  const ollamaTemperature = readStrictDecimal(
    config,
    ['AI_OLLAMA_TEMPERATURE'],
    0.4,
    {
      min: 0,
      max: 2,
      label: 'AI_OLLAMA_TEMPERATURE',
    },
  );

  const ollamaPreciseTemperature = readStrictDecimal(
    config,
    ['AI_OLLAMA_PRECISE_TEMPERATURE'],
    0.4,
    {
      min: 0,
      max: 2,
      label: 'AI_OLLAMA_PRECISE_TEMPERATURE',
    },
  );

  const ollamaCreativeTemperature = readStrictDecimal(
    config,
    ['AI_OLLAMA_CREATIVE_TEMPERATURE'],
    0.55,
    {
      min: 0,
      max: 2,
      label: 'AI_OLLAMA_CREATIVE_TEMPERATURE',
    },
  );

  const aiRuntimeMaxConcurrent = readStrictNumber(
    config,
    ['AI_RUNTIME_MAX_CONCURRENT'],
    1,
    {
      min: 1,
      max: 2,
      label: 'AI_RUNTIME_MAX_CONCURRENT',
    },
  );

  const aiRuntimeMaxQueueDepth = readStrictNumber(
    config,
    ['AI_RUNTIME_MAX_QUEUE_DEPTH'],
    24,
    {
      min: 1,
      max: 200,
      label: 'AI_RUNTIME_MAX_QUEUE_DEPTH',
    },
  );

  const aiRuntimeQueueTimeoutMs = readStrictNumber(
    config,
    ['AI_RUNTIME_QUEUE_TIMEOUT_MS'],
    300_000,
    {
      min: 1_000,
      max: 900_000,
      label: 'AI_RUNTIME_QUEUE_TIMEOUT_MS',
    },
  );

  const aiRerankerEnabled = readStrictBooleanAsString(
    config,
    ['AI_RERANKER_ENABLED'],
    true,
    'AI reranker enabled state',
  );

  const aiRerankerBaseUrl = normalizeOllamaBaseUrl(
    readConsistentStringAliases(
      config,
      ['AI_RERANKER_BASE_URL'],
      'http://reranker:8080',
      'AI reranker base URL',
    ),
    nodeEnv,
  );

  const aiRerankerTimeoutMs = readStrictNumber(
    config,
    ['AI_RERANKER_TIMEOUT_MS'],
    120_000,
    {
      min: 1_000,
      max: 600_000,
      label: 'AI_RERANKER_TIMEOUT_MS',
    },
  );

  const aiRerankerMaxLength = readStrictNumber(
    config,
    ['AI_RERANKER_MAX_LENGTH'],
    2048,
    {
      min: 256,
      max: 8192,
      label: 'AI_RERANKER_MAX_LENGTH',
    },
  );

  const aiRerankerBatchSize = readStrictNumber(
    config,
    ['AI_RERANKER_BATCH_SIZE'],
    4,
    {
      min: 1,
      max: 16,
      label: 'AI_RERANKER_BATCH_SIZE',
    },
  );

  const aiRetrievalCandidateLimit = readStrictNumber(
    config,
    ['AI_RETRIEVAL_CANDIDATE_LIMIT'],
    36,
    {
      min: 4,
      max: 100,
      label: 'AI_RETRIEVAL_CANDIDATE_LIMIT',
    },
  );

  const aiRetrievalRerankLimit = readStrictNumber(
    config,
    ['AI_RETRIEVAL_RERANK_LIMIT'],
    12,
    {
      min: 2,
      max: 40,
      label: 'AI_RETRIEVAL_RERANK_LIMIT',
    },
  );

  const aiRetrievalEmbedBatchSize = readStrictNumber(
    config,
    ['AI_RETRIEVAL_EMBED_BATCH_SIZE'],
    4,
    {
      min: 1,
      max: 12,
      label: 'AI_RETRIEVAL_EMBED_BATCH_SIZE',
    },
  );

  const aiRetrievalCacheMaxEntries = readStrictNumber(
    config,
    ['AI_RETRIEVAL_CACHE_MAX_ENTRIES'],
    1500,
    {
      min: 50,
      max: 20_000,
      label: 'AI_RETRIEVAL_CACHE_MAX_ENTRIES',
    },
  );

  const bodyLimit = readString(config, ['BODY_LIMIT'], '10mb')!;

  const explicitBunnyStorageEnabled = readString(config, [
    'BUNNY_STORAGE_ENABLED',
  ]);

  const bunnyStorageEnabled = readStrictBooleanAsString(
    config,
    ['BUNNY_STORAGE_ENABLED'],
    false,
    'Bunny storage enabled state',
  );

  const bunnyStorageZone = validateBunnyStorageZone(
    readConsistentStringAliases(
      config,
      ['BUNNY_STORAGE_ZONE_NAME', 'BUNNY_STORAGE_ZONE'],
      '',
      'Bunny storage zone',
    ),
  );

  const bunnyStorageApiKey = validateBunnyStorageAccessKey(
    readConsistentSecretAliases(
      config,
      ['BUNNY_STORAGE_API_KEY', 'BUNNY_STORAGE_ACCESS_KEY'],
      '',
      'Bunny storage access key',
    ),
    nodeEnv,
  );

  const bunnyCdnUrlRaw = readConsistentStringAliases(
    config,
    ['BUNNY_CDN_URL', 'NEXT_PUBLIC_BUNNY_CDN_URL'],
    '',
    'Bunny CDN URL',
  );

  const inferredMediaDriver: ValidMediaStorageDriver =
    bunnyStorageEnabled === 'true' ||
    (explicitBunnyStorageEnabled === undefined && bunnyStorageZone.length > 0)
      ? 'bunny'
      : 'local';

  const configuredMediaDrivers = ['MEDIA_STORAGE_DRIVER', 'STORAGE_DRIVER']
    .map((key) => ({
      key,
      value: readString(config, [key]),
    }))
    .filter(
      (entry): entry is { key: string; value: string } =>
        entry.value !== undefined,
    )
    .map((entry) => ({
      key: entry.key,
      value: normalizeMediaStorageDriver(entry.value, inferredMediaDriver),
    }));

  const uniqueConfiguredMediaDrivers = [
    ...new Set(configuredMediaDrivers.map((entry) => entry.value)),
  ];

  if (uniqueConfiguredMediaDrivers.length > 1) {
    throw new Error(
      `Conflicting media storage drivers: ${configuredMediaDrivers
        .map((entry) => `${entry.key}=${entry.value}`)
        .join(', ')}`,
    );
  }

  const mediaStorageDriver =
    uniqueConfiguredMediaDrivers[0] ?? inferredMediaDriver;

  if (bunnyStorageEnabled === 'true' && mediaStorageDriver !== 'bunny') {
    throw new Error(
      'BUNNY_STORAGE_ENABLED=true conflicts with MEDIA_STORAGE_DRIVER=local.',
    );
  }

  if (
    explicitBunnyStorageEnabled !== undefined &&
    bunnyStorageEnabled === 'false' &&
    mediaStorageDriver === 'bunny'
  ) {
    throw new Error(
      'BUNNY_STORAGE_ENABLED=false conflicts with MEDIA_STORAGE_DRIVER=bunny.',
    );
  }

  const mediaMaxFileSizeBytes = readStrictNumber(
    config,
    ['MEDIA_MAX_FILE_SIZE_BYTES'],
    10 * 1024 * 1024,
    {
      min: 1,
      max: 1024 * 1024 * 1024,
      label: 'MEDIA_MAX_FILE_SIZE_BYTES',
    },
  );

  const mediaAllowSvg = readStrictBooleanAsString(
    config,
    ['MEDIA_ALLOW_SVG'],
    false,
    'MEDIA_ALLOW_SVG',
  );

  const mediaLocalRoot = requireValue(
    readString(
      config,
      ['MEDIA_LOCAL_ROOT', 'LOCAL_UPLOAD_DIR'],
      'public/uploads',
    ),
    'MEDIA_LOCAL_ROOT',
  );

  if (mediaLocalRoot.includes('\0')) {
    throw new Error('MEDIA_LOCAL_ROOT contains an invalid null character.');
  }

  const mediaPublicBaseUrl = normalizeMediaPublicBaseUrl(
    readString(
      config,
      ['MEDIA_PUBLIC_BASE_URL', 'LOCAL_PUBLIC_BASE_URL'],
      '/uploads',
    )!,
    nodeEnv,
  );

  const mediaLocalServeEnabled = readStrictBooleanAsString(
    config,
    ['MEDIA_LOCAL_SERVE_ENABLED'],
    mediaStorageDriver === 'local',
    'MEDIA_LOCAL_SERVE_ENABLED',
  );

  const mediaStorageRequestTimeoutMs = readStrictNumber(
    config,
    ['MEDIA_STORAGE_REQUEST_TIMEOUT_MS'],
    15_000,
    {
      min: 1_000,
      max: 120_000,
      label: 'MEDIA_STORAGE_REQUEST_TIMEOUT_MS',
    },
  );

  const bunnyStorageEndpoint = normalizePublicApplicationUrl(
    readConsistentStringAliases(
      config,
      ['BUNNY_STORAGE_ENDPOINT', 'BUNNY_STORAGE_BASE_URL'],
      'https://storage.bunnycdn.com',
      'Bunny storage endpoint',
    ),
    'BUNNY_STORAGE_ENDPOINT',
    nodeEnv,
    {
      required: true,
    },
  );

  const mediaPublicBaseIsPath = mediaPublicBaseUrl.startsWith('/');

  if (mediaStorageDriver === 'local') {
    if (mediaLocalServeEnabled === 'true' && !mediaPublicBaseIsPath) {
      throw new Error(
        'MEDIA_PUBLIC_BASE_URL must be a path when MEDIA_LOCAL_SERVE_ENABLED=true.',
      );
    }

    if (mediaLocalServeEnabled === 'false' && mediaPublicBaseIsPath) {
      throw new Error(
        'MEDIA_PUBLIC_BASE_URL must be an absolute URL when local media serving is disabled.',
      );
    }
  } else if (mediaLocalServeEnabled === 'true') {
    throw new Error(
      'MEDIA_LOCAL_SERVE_ENABLED=true conflicts with MEDIA_STORAGE_DRIVER=bunny.',
    );
  }

  if (mediaStorageDriver === 'bunny') {
    const missingBunnyVariables = [
      bunnyStorageZone.length > 0 ? null : 'BUNNY_STORAGE_ZONE_NAME',
      bunnyStorageApiKey.length > 0 ? null : 'BUNNY_STORAGE_API_KEY',
      bunnyCdnUrlRaw.length > 0 ? null : 'BUNNY_CDN_URL',
    ].filter((value): value is string => value !== null);

    if (missingBunnyVariables.length > 0) {
      throw new Error(
        `Missing required Bunny storage environment variables: ${missingBunnyVariables.join(', ')}`,
      );
    }
  }

  const bunnyCdnUrl = normalizePublicApplicationUrl(
    bunnyCdnUrlRaw,
    'BUNNY_CDN_URL',
    nodeEnv,
  );

  const corsOrigins = normalizeCorsOrigins(
    readString(config, ['CORS_ORIGINS', 'CORS_ORIGIN']),
    frontendUrl,
    nodeEnv,
  );

  const corsCredentials = readBooleanAsString(
    config,
    ['CORS_CREDENTIALS'],
    true,
  );

  const bcryptSaltRounds = readNumber(config, ['BCRYPT_SALT_ROUNDS'], 12, {
    min: 8,
    max: 15,
  });

  const jwtAccessExpiresIn = readString(
    config,
    ['JWT_ACCESS_EXPIRES_IN', 'JWT_ACCESS_TOKEN_EXPIRES_IN'],
    '15m',
  )!;

  const jwtRefreshExpiresIn = readString(
    config,
    ['JWT_REFRESH_EXPIRES_IN', 'JWT_REFRESH_TOKEN_EXPIRES_IN'],
    '30d',
  )!;

  const jwtRefreshExpiresDays = readNumber(
    config,
    ['JWT_REFRESH_EXPIRES_DAYS'],
    parseRefreshExpiresDays(jwtRefreshExpiresIn),
    {
      min: 1,
      max: 365,
    },
  );

  const productionLikeEnvironment = isProductionLike(nodeEnv);
  const rateLimitEnabled = readStrictBooleanAsString(
    config,
    ['RATE_LIMIT_ENABLED'],
    true,
    'rate limiting',
  );

  const rateLimitStorageDriver = normalizeRateLimitStorageDriver(
    readString(
      config,
      ['RATE_LIMIT_STORAGE_DRIVER'],
      productionLikeEnvironment ? 'redis' : 'memory',
    ),
  );

  const rateLimitRedisRequired = readStrictBooleanAsString(
    config,
    ['RATE_LIMIT_REDIS_REQUIRED'],
    productionLikeEnvironment,
    'rate-limit Redis requirement',
  );

  const rateLimitTrustProxy = readStrictBooleanAsString(
    config,
    ['RATE_LIMIT_TRUST_PROXY', 'TRUST_PROXY'],
    false,
    'rate-limit proxy trust',
  );

  const rateLimitKeyPrefix = readString(
    config,
    ['RATE_LIMIT_KEY_PREFIX'],
    'vexo:rate-limit',
  )!;

  const rateLimitDefaultLimit = readNumber(
    config,
    ['RATE_LIMIT_DEFAULT_LIMIT'],
    120,
    { min: 1, max: 100_000 },
  );
  const rateLimitDefaultTtlMs = readNumber(
    config,
    ['RATE_LIMIT_DEFAULT_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitDefaultBlockMs = readNumber(
    config,
    ['RATE_LIMIT_DEFAULT_BLOCK_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitPublicLimit = readNumber(
    config,
    ['RATE_LIMIT_PUBLIC_LIMIT'],
    180,
    { min: 1, max: 100_000 },
  );
  const rateLimitPublicTtlMs = readNumber(
    config,
    ['RATE_LIMIT_PUBLIC_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitPublicBlockMs = readNumber(
    config,
    ['RATE_LIMIT_PUBLIC_BLOCK_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitAuthLimit = readNumber(config, ['RATE_LIMIT_AUTH_LIMIT'], 10, {
    min: 1,
    max: 10_000,
  });
  const rateLimitAuthTtlMs = readNumber(
    config,
    ['RATE_LIMIT_AUTH_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitAuthBlockMs = readNumber(
    config,
    ['RATE_LIMIT_AUTH_BLOCK_MS'],
    120_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitSensitiveLimit = readNumber(
    config,
    ['RATE_LIMIT_SENSITIVE_LIMIT'],
    30,
    { min: 1, max: 100_000 },
  );
  const rateLimitSensitiveTtlMs = readNumber(
    config,
    ['RATE_LIMIT_SENSITIVE_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitSensitiveBlockMs = readNumber(
    config,
    ['RATE_LIMIT_SENSITIVE_BLOCK_MS'],
    120_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitUploadLimit = readNumber(
    config,
    ['RATE_LIMIT_UPLOAD_LIMIT'],
    20,
    { min: 1, max: 100_000 },
  );
  const rateLimitUploadTtlMs = readNumber(
    config,
    ['RATE_LIMIT_UPLOAD_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitUploadBlockMs = readNumber(
    config,
    ['RATE_LIMIT_UPLOAD_BLOCK_MS'],
    120_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitSearchLimit = readNumber(
    config,
    ['RATE_LIMIT_SEARCH_LIMIT'],
    60,
    { min: 1, max: 100_000 },
  );
  const rateLimitSearchTtlMs = readNumber(
    config,
    ['RATE_LIMIT_SEARCH_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitSearchBlockMs = readNumber(
    config,
    ['RATE_LIMIT_SEARCH_BLOCK_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitAdminLimit = readNumber(
    config,
    ['RATE_LIMIT_ADMIN_LIMIT'],
    90,
    { min: 1, max: 100_000 },
  );
  const rateLimitAdminTtlMs = readNumber(
    config,
    ['RATE_LIMIT_ADMIN_TTL_MS'],
    60_000,
    { min: 1_000, max: 86_400_000 },
  );
  const rateLimitAdminBlockMs = readNumber(
    config,
    ['RATE_LIMIT_ADMIN_BLOCK_MS'],
    120_000,
    { min: 1_000, max: 86_400_000 },
  );

  const rateLimitSkipPaths = readString(config, ['RATE_LIMIT_SKIP_PATHS'], '')!;

  if (rateLimitRedisRequired === 'true' && rateLimitStorageDriver !== 'redis') {
    throw new Error(
      'RATE_LIMIT_REDIS_REQUIRED=true requires RATE_LIMIT_STORAGE_DRIVER=redis.',
    );
  }

  if (productionLikeEnvironment && rateLimitEnabled !== 'true') {
    throw new Error(
      'RATE_LIMIT_ENABLED must remain enabled in production/staging.',
    );
  }

  if (productionLikeEnvironment && rateLimitStorageDriver !== 'redis') {
    throw new Error(
      'RATE_LIMIT_STORAGE_DRIVER must be redis in production/staging.',
    );
  }

  if (productionLikeEnvironment && rateLimitRedisRequired !== 'true') {
    throw new Error(
      'RATE_LIMIT_REDIS_REQUIRED must be true in production/staging.',
    );
  }

  if (productionLikeEnvironment && rateLimitSkipPaths.trim().length > 0) {
    throw new Error(
      'RATE_LIMIT_SKIP_PATHS must be empty in production/staging.',
    );
  }

  const queueEnabled = readBooleanAsString(config, ['QUEUE_ENABLED'], true);
  const queueRedisRequired = readBooleanAsString(
    config,
    ['QUEUE_REDIS_REQUIRED'],
    true,
  );
  const queuePrefix = readString(config, ['QUEUE_PREFIX'], 'vexo:queue')!;

  const queueDefaultAttempts = readNumber(
    config,
    ['QUEUE_DEFAULT_ATTEMPTS'],
    3,
    { min: 1, max: 20 },
  );
  const queueDefaultBackoffDelayMs = readNumber(
    config,
    ['QUEUE_DEFAULT_BACKOFF_DELAY_MS'],
    5_000,
    { min: 100, max: 3_600_000 },
  );
  const queueDefaultTimeoutMs = readNumber(
    config,
    ['QUEUE_DEFAULT_TIMEOUT_MS'],
    60_000,
    { min: 1_000, max: 3_600_000 },
  );
  const queueRemoveOnCompleteCount = readNumber(
    config,
    ['QUEUE_REMOVE_ON_COMPLETE_COUNT'],
    1_000,
    { min: 1, max: 100_000 },
  );
  const queueRemoveOnFailCount = readNumber(
    config,
    ['QUEUE_REMOVE_ON_FAIL_COUNT'],
    5_000,
    { min: 1, max: 100_000 },
  );
  const queueWorkerConcurrency = readNumber(
    config,
    ['QUEUE_WORKER_CONCURRENCY'],
    5,
    { min: 1, max: 100 },
  );
  const queueStalledIntervalMs = readNumber(
    config,
    ['QUEUE_STALLED_INTERVAL_MS'],
    30_000,
    { min: 5_000, max: 300_000 },
  );
  const queueMaxStalledCount = readNumber(
    config,
    ['QUEUE_MAX_STALLED_COUNT'],
    1,
    { min: 0, max: 10 },
  );

  const queueHealthBacklogWarningThreshold = readNumber(
    config,
    ['QUEUE_HEALTH_BACKLOG_WARNING_THRESHOLD'],
    25,
    { min: 1, max: 999_999 },
  );
  const queueHealthBacklogCriticalThreshold = Math.max(
    queueHealthBacklogWarningThreshold + 1,
    readNumber(config, ['QUEUE_HEALTH_BACKLOG_CRITICAL_THRESHOLD'], 100, {
      min: 2,
      max: 1_000_000,
    }),
  );
  const queueHealthFailedWarningThreshold = readNumber(
    config,
    [
      'QUEUE_HEALTH_FAILED_WARNING_THRESHOLD',
      'SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD',
    ],
    10,
    { min: 1, max: 999_999 },
  );
  const queueHealthFailedCriticalThreshold = Math.max(
    queueHealthFailedWarningThreshold + 1,
    readNumber(config, ['QUEUE_HEALTH_FAILED_CRITICAL_THRESHOLD'], 50, {
      min: 2,
      max: 1_000_000,
    }),
  );
  const queueHealthDelayedWarningThreshold = readNumber(
    config,
    ['QUEUE_HEALTH_DELAYED_WARNING_THRESHOLD'],
    25,
    { min: 1, max: 999_999 },
  );
  const queueHealthDelayedCriticalThreshold = Math.max(
    queueHealthDelayedWarningThreshold + 1,
    readNumber(config, ['QUEUE_HEALTH_DELAYED_CRITICAL_THRESHOLD'], 100, {
      min: 2,
      max: 1_000_000,
    }),
  );
  const queueHealthFailureRateWarningPercent = readNumber(
    config,
    ['QUEUE_HEALTH_FAILURE_RATE_WARNING_PERCENT'],
    20,
    { min: 1, max: 99 },
  );
  const queueHealthFailureRateCriticalPercent = Math.min(
    100,
    Math.max(
      queueHealthFailureRateWarningPercent + 1,
      readNumber(config, ['QUEUE_HEALTH_FAILURE_RATE_CRITICAL_PERCENT'], 50, {
        min: 2,
        max: 100,
      }),
    ),
  );
  const queueHealthFailureRateMinSample = readNumber(
    config,
    ['QUEUE_HEALTH_FAILURE_RATE_MIN_SAMPLE'],
    20,
    { min: 1, max: 1_000_000 },
  );

  const queueRedisHost = readString(
    config,
    ['QUEUE_REDIS_HOST', 'REDIS_HOST'],
    '127.0.0.1',
  )!;
  const queueRedisPort = readNumber(
    config,
    ['QUEUE_REDIS_PORT', 'REDIS_PORT'],
    6379,
    { min: 1, max: 65_535 },
  );
  const queueRedisDb = readNumber(config, ['QUEUE_REDIS_DB', 'REDIS_DB'], 0, {
    min: 0,
    max: 15,
  });
  const queueRedisTls = readBooleanAsString(
    config,
    ['QUEUE_REDIS_TLS', 'REDIS_TLS'],
    false,
  );
  const queueRedisConnectTimeoutMs = readNumber(
    config,
    ['QUEUE_REDIS_CONNECT_TIMEOUT_MS', 'REDIS_CONNECT_TIMEOUT_MS'],
    3_000,
    { min: 100, max: 60_000 },
  );
  const queueRedisMaxRetries = readNumber(
    config,
    ['QUEUE_REDIS_MAX_RETRIES', 'REDIS_MAX_RETRIES'],
    3,
    { min: 0, max: 20 },
  );

  const schedulerEnabled = readBooleanAsString(
    config,
    ['SCHEDULER_ENABLED'],
    true,
  );
  const schedulerTimezone = readString(
    config,
    ['SCHEDULER_TIMEZONE'],
    'Asia/Tehran',
  )!;
  const schedulerMediaCleanupEnabled = readBooleanAsString(
    config,
    ['SCHEDULER_MEDIA_CLEANUP_ENABLED'],
    true,
  );
  const schedulerMediaCleanupCron = normalizeCronExpression(
    readString(config, ['SCHEDULER_MEDIA_CLEANUP_CRON'], '0 * * * *'),
    '0 * * * *',
  );
  const schedulerMediaCleanupOlderThanMinutes = readNumber(
    config,
    ['SCHEDULER_MEDIA_CLEANUP_OLDER_THAN_MINUTES'],
    1440,
    { min: 1, max: 525_600 },
  );
  const schedulerMediaCleanupDryRun = readBooleanAsString(
    config,
    ['SCHEDULER_MEDIA_CLEANUP_DRY_RUN'],
    false,
  );
  const schedulerQueueHealthEnabled = readBooleanAsString(
    config,
    ['SCHEDULER_QUEUE_HEALTH_ENABLED'],
    true,
  );
  const schedulerQueueHealthCron = normalizeCronExpression(
    readString(config, ['SCHEDULER_QUEUE_HEALTH_CRON'], '*/5 * * * *'),
    '*/5 * * * *',
  );
  const schedulerQueueHealthFailedWarningThreshold = readNumber(
    config,
    ['SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD'],
    10,
    { min: 1, max: 1_000_000 },
  );

  const validated: ValidatedEnv = {
    ...config,

    NODE_ENV: nodeEnv,
    APP_NAME: appName,
    APP_VERSION: appVersion,
    HOST: host,
    PORT: port,
    APP_URL: appUrl,
    FRONTEND_URL: frontendUrl,
    API_PREFIX: apiPrefix,
    BODY_LIMIT: bodyLimit,
    CORS_ORIGINS: corsOrigins,
    CORS_CREDENTIALS: corsCredentials,

    MEDIA_STORAGE_DRIVER: mediaStorageDriver,
    STORAGE_DRIVER: mediaStorageDriver,
    MEDIA_MAX_FILE_SIZE_BYTES: mediaMaxFileSizeBytes,
    MEDIA_ALLOW_SVG: mediaAllowSvg,
    MEDIA_LOCAL_ROOT: mediaLocalRoot,
    LOCAL_UPLOAD_DIR: mediaLocalRoot,
    MEDIA_PUBLIC_BASE_URL: mediaPublicBaseUrl,
    LOCAL_PUBLIC_BASE_URL: mediaPublicBaseUrl,
    MEDIA_LOCAL_SERVE_ENABLED: mediaLocalServeEnabled,
    MEDIA_STORAGE_REQUEST_TIMEOUT_MS: mediaStorageRequestTimeoutMs,
    BUNNY_STORAGE_ENABLED: String(mediaStorageDriver === 'bunny'),
    BUNNY_STORAGE_ZONE: bunnyStorageZone,
    BUNNY_STORAGE_ZONE_NAME: bunnyStorageZone,
    BUNNY_STORAGE_API_KEY: bunnyStorageApiKey,
    BUNNY_STORAGE_ACCESS_KEY: bunnyStorageApiKey,
    BUNNY_STORAGE_ENDPOINT: bunnyStorageEndpoint,
    BUNNY_STORAGE_BASE_URL: bunnyStorageEndpoint,
    BUNNY_CDN_URL: bunnyCdnUrl,
    NEXT_PUBLIC_BUNNY_CDN_URL: bunnyCdnUrl,

    DATABASE_URL: databaseUrl,
    DATABASE_LOG_QUERIES: databaseLogQueries,
    DATABASE_CONNECTION_TIMEOUT_MS: databaseConnectionTimeoutMs,
    DATABASE_STATEMENT_TIMEOUT_MS: databaseStatementTimeoutMs,
    DATABASE_QUERY_TIMEOUT_MS: databaseQueryTimeoutMs,
    DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: databaseIdleTransactionTimeoutMs,
    DATABASE_TRANSACTION_TIMEOUT_MS: databaseTransactionTimeoutMs,
    DATABASE_MAX_WAIT_MS: databaseMaxWaitMs,
    DATABASE_POOL_MIN: databasePoolMin,
    DATABASE_POOL_MAX: databasePoolMax,
    DATABASE_POOL_IDLE_TIMEOUT_MS: databasePoolIdleTimeoutMs,
    DATABASE_POOL_MAX_LIFETIME_SECONDS: databasePoolMaxLifetimeSeconds,
    DATABASE_APPLICATION_NAME: databaseApplicationName,
    DATABASE_MIGRATIONS_REQUIRED: databaseMigrationsRequired,

    DEFAULT_CURRENCY: defaultCurrency,
    PAYMENT_GATEWAY: paymentGateway,
    PAYMENT_CALLBACK_URL: paymentCallbackUrl,
    PAYMENT_SANDBOX: paymentSandbox,
    PAYMENT_SUCCESS_REDIRECT_URL: paymentSuccessRedirectUrl,
    PAYMENT_FAILURE_REDIRECT_URL: paymentFailureRedirectUrl,
    PAYMENT_RECEIPT_BASE_URL: paymentReceiptBaseUrl,
    ZARINPAL_MERCHANT_ID: zarinpalMerchantId,
    ZARINPAL_SANDBOX: paymentSandbox,
    ZARINPAL_CALLBACK_URL: paymentCallbackUrl,
    ZARINPAL_HTTP_TIMEOUT_MS: zarinpalHttpTimeoutMs,
    ZARINPAL_REQUEST_URL: zarinpalRequestUrl,
    ZARINPAL_VERIFY_URL: zarinpalVerifyUrl,
    ZARINPAL_START_PAY_URL: zarinpalStartPayUrl,

    NOTIFICATION_ENABLED: notificationEnabled,
    NOTIFICATION_EMAIL_ENABLED: emailEnabled,
    EMAIL_ENABLED: emailEnabled,
    MAIL_ENABLED: emailEnabled,
    SMTP_HOST: smtpHost,
    EMAIL_SMTP_HOST: smtpHost,
    MAIL_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    MAIL_PORT: smtpPort,
    SMTP_SECURE: smtpSecure,
    MAIL_SECURE: smtpSecure,
    SMTP_USER: smtpUser,
    MAIL_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
    MAIL_PASSWORD: smtpPassword,
    SMTP_FROM_NAME: smtpFromName,
    MAIL_FROM_NAME: smtpFromName,
    NOTIFICATION_SENDER_NAME: smtpFromName,
    SMTP_FROM_ADDRESS: smtpFromAddress,
    EMAIL_FROM_ADDRESS: smtpFromAddress,
    MAIL_FROM_EMAIL: smtpFromAddress,
    NOTIFICATION_SENDER_EMAIL: smtpFromAddress,
    NOTIFICATION_USER_EMAIL_COLUMN: notificationUserEmailColumn,
    NOTIFICATION_SMS_ENABLED: smsEnabled,
    SMS_ENABLED: smsEnabled,
    SMS_PROVIDER: smsProvider,
    SMS_PROVIDER_NAME: smsProvider,
    SMS_PROVIDER_URL: smsProviderUrl,
    SMS_API_KEY: smsProviderToken,
    SMS_PROVIDER_TOKEN: smsProviderToken,
    SMS_PROVIDER_TOKEN_HEADER: smsProviderTokenHeader,
    SMS_PROVIDER_TOKEN_PREFIX: smsProviderTokenPrefix,
    SMS_PROVIDER_RECIPIENT_FIELD: smsProviderRecipientField,
    SMS_PROVIDER_MESSAGE_FIELD: smsProviderMessageField,
    SMS_PROVIDER_TEMPLATE_FIELD: smsProviderTemplateField,
    SMS_PROVIDER_SENDER_FIELD: smsProviderSenderField,
    SMS_SENDER: smsSender,
    SMS_HTTP_TIMEOUT_MS: smsHttpTimeoutMs,
    NOTIFICATION_USER_PHONE_COLUMN: notificationUserPhoneColumn,
    NOTIFICATION_PUSH_ENABLED: pushEnabled,
    PUSH_ENABLED: pushEnabled,
    VAPID_PUBLIC_KEY: vapidPublicKey,
    VAPID_PRIVATE_KEY: vapidPrivateKey,
    VAPID_SUBJECT: vapidSubject,

    AI_ENABLED: aiEnabled,
    AI_PROVIDER: aiProvider,
    AI_REQUEST_TIMEOUT_MS: aiRequestTimeoutMs,
    HEALTH_REQUIRE_AI: healthRequireAi,
    AI_OLLAMA_THINK: ollamaThink,
    AI_OLLAMA_BASE_URL: ollamaBaseUrl,
    OLLAMA_BASE_URL: ollamaBaseUrl,
    AI_OLLAMA_DEFAULT_MODEL: ollamaDefaultModel,
    OLLAMA_MODEL: ollamaDefaultModel,
    AI_OLLAMA_PUBLIC_MODEL: ollamaPublicModel,
    AI_OLLAMA_CONSULTING_MODEL: ollamaConsultingModel,
    AI_OLLAMA_SALES_MODEL: ollamaSalesModel,
    AI_OLLAMA_CONTENT_MODEL: ollamaContentModel,
    AI_OLLAMA_SEO_MODEL: ollamaSeoModel,
    AI_OLLAMA_SMS_MODEL: ollamaSmsModel,
    AI_OLLAMA_BANNER_TEXT_MODEL: ollamaBannerTextModel,
    AI_OLLAMA_RECOMMENDATION_MODEL: ollamaRecommendationModel,
    AI_OLLAMA_COMPARISON_MODEL: ollamaComparisonModel,
    AI_OLLAMA_EMBEDDING_MODEL: ollamaEmbeddingModel,
    AI_OLLAMA_ANALYTICS_MODEL: ollamaAnalyticsModel,
    AI_OLLAMA_MARKETING_STRATEGY_MODEL: ollamaMarketingStrategyModel,
    AI_OLLAMA_DISCOUNT_MODEL: ollamaDiscountModel,
    AI_OLLAMA_ADMIN_REPORT_MODEL: ollamaAdminReportModel,
    AI_OLLAMA_DEMAND_ANALYSIS_MODEL: ollamaDemandAnalysisModel,
    AI_OLLAMA_VISION_MODEL: ollamaVisionModel,
    AI_OLLAMA_ALT_TEXT_MODEL: ollamaAltTextModel,
    AI_OLLAMA_IMAGE_DESCRIPTION_MODEL: ollamaImageDescriptionModel,
    AI_OLLAMA_FALLBACK_MODEL: ollamaFallbackModel,
    AI_OLLAMA_TIMEOUT_MS: ollamaTimeoutMs,
    OLLAMA_TIMEOUT_MS: ollamaTimeoutMs,
    AI_OLLAMA_KEEP_ALIVE: ollamaKeepAlive,
    AI_OLLAMA_NUM_CTX: ollamaNumCtx,
    AI_OLLAMA_NUM_PREDICT: ollamaNumPredict,
    AI_OLLAMA_LONG_NUM_PREDICT: ollamaLongNumPredict,
    AI_OLLAMA_TEMPERATURE: ollamaTemperature,
    AI_OLLAMA_PRECISE_TEMPERATURE: ollamaPreciseTemperature,
    AI_OLLAMA_CREATIVE_TEMPERATURE: ollamaCreativeTemperature,
    AI_RUNTIME_MAX_CONCURRENT: aiRuntimeMaxConcurrent,
    AI_RUNTIME_MAX_QUEUE_DEPTH: aiRuntimeMaxQueueDepth,
    AI_RUNTIME_QUEUE_TIMEOUT_MS: aiRuntimeQueueTimeoutMs,
    AI_RERANKER_ENABLED: aiRerankerEnabled,
    AI_RERANKER_BASE_URL: aiRerankerBaseUrl,
    AI_RERANKER_TIMEOUT_MS: aiRerankerTimeoutMs,
    AI_RERANKER_MAX_LENGTH: aiRerankerMaxLength,
    AI_RERANKER_BATCH_SIZE: aiRerankerBatchSize,
    AI_RETRIEVAL_CANDIDATE_LIMIT: aiRetrievalCandidateLimit,
    AI_RETRIEVAL_RERANK_LIMIT: aiRetrievalRerankLimit,
    AI_RETRIEVAL_EMBED_BATCH_SIZE: aiRetrievalEmbedBatchSize,
    AI_RETRIEVAL_CACHE_MAX_ENTRIES: aiRetrievalCacheMaxEntries,

    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_TOKEN_SECRET: jwtAccessSecret,
    JWT_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_REFRESH_TOKEN_SECRET: jwtRefreshSecret,
    JWT_ACCESS_EXPIRES_IN: jwtAccessExpiresIn,
    JWT_ACCESS_TOKEN_EXPIRES_IN: jwtAccessExpiresIn,
    JWT_REFRESH_EXPIRES_IN: jwtRefreshExpiresIn,
    JWT_REFRESH_TOKEN_EXPIRES_IN: jwtRefreshExpiresIn,
    JWT_REFRESH_EXPIRES_DAYS: jwtRefreshExpiresDays,

    BCRYPT_SALT_ROUNDS: bcryptSaltRounds,

    RATE_LIMIT_ENABLED: rateLimitEnabled,
    RATE_LIMIT_STORAGE_DRIVER: rateLimitStorageDriver,
    RATE_LIMIT_REDIS_REQUIRED: rateLimitRedisRequired,
    RATE_LIMIT_TRUST_PROXY: rateLimitTrustProxy,
    RATE_LIMIT_KEY_PREFIX: rateLimitKeyPrefix,
    RATE_LIMIT_DEFAULT_LIMIT: rateLimitDefaultLimit,
    RATE_LIMIT_DEFAULT_TTL_MS: rateLimitDefaultTtlMs,
    RATE_LIMIT_DEFAULT_BLOCK_MS: rateLimitDefaultBlockMs,
    RATE_LIMIT_PUBLIC_LIMIT: rateLimitPublicLimit,
    RATE_LIMIT_PUBLIC_TTL_MS: rateLimitPublicTtlMs,
    RATE_LIMIT_PUBLIC_BLOCK_MS: rateLimitPublicBlockMs,
    RATE_LIMIT_AUTH_LIMIT: rateLimitAuthLimit,
    RATE_LIMIT_AUTH_TTL_MS: rateLimitAuthTtlMs,
    RATE_LIMIT_AUTH_BLOCK_MS: rateLimitAuthBlockMs,
    RATE_LIMIT_SENSITIVE_LIMIT: rateLimitSensitiveLimit,
    RATE_LIMIT_SENSITIVE_TTL_MS: rateLimitSensitiveTtlMs,
    RATE_LIMIT_SENSITIVE_BLOCK_MS: rateLimitSensitiveBlockMs,
    RATE_LIMIT_UPLOAD_LIMIT: rateLimitUploadLimit,
    RATE_LIMIT_UPLOAD_TTL_MS: rateLimitUploadTtlMs,
    RATE_LIMIT_UPLOAD_BLOCK_MS: rateLimitUploadBlockMs,
    RATE_LIMIT_SEARCH_LIMIT: rateLimitSearchLimit,
    RATE_LIMIT_SEARCH_TTL_MS: rateLimitSearchTtlMs,
    RATE_LIMIT_SEARCH_BLOCK_MS: rateLimitSearchBlockMs,
    RATE_LIMIT_ADMIN_LIMIT: rateLimitAdminLimit,
    RATE_LIMIT_ADMIN_TTL_MS: rateLimitAdminTtlMs,
    RATE_LIMIT_ADMIN_BLOCK_MS: rateLimitAdminBlockMs,
    RATE_LIMIT_SKIP_PATHS: rateLimitSkipPaths,

    QUEUE_ENABLED: queueEnabled,
    QUEUE_REDIS_REQUIRED: queueRedisRequired,
    QUEUE_PREFIX: queuePrefix,
    QUEUE_DEFAULT_ATTEMPTS: queueDefaultAttempts,
    QUEUE_DEFAULT_BACKOFF_DELAY_MS: queueDefaultBackoffDelayMs,
    QUEUE_DEFAULT_TIMEOUT_MS: queueDefaultTimeoutMs,
    QUEUE_REMOVE_ON_COMPLETE_COUNT: queueRemoveOnCompleteCount,
    QUEUE_REMOVE_ON_FAIL_COUNT: queueRemoveOnFailCount,
    QUEUE_WORKER_CONCURRENCY: queueWorkerConcurrency,
    QUEUE_STALLED_INTERVAL_MS: queueStalledIntervalMs,
    QUEUE_MAX_STALLED_COUNT: queueMaxStalledCount,
    QUEUE_HEALTH_BACKLOG_WARNING_THRESHOLD: queueHealthBacklogWarningThreshold,
    QUEUE_HEALTH_BACKLOG_CRITICAL_THRESHOLD:
      queueHealthBacklogCriticalThreshold,
    QUEUE_HEALTH_FAILED_WARNING_THRESHOLD: queueHealthFailedWarningThreshold,
    QUEUE_HEALTH_FAILED_CRITICAL_THRESHOLD: queueHealthFailedCriticalThreshold,
    QUEUE_HEALTH_DELAYED_WARNING_THRESHOLD: queueHealthDelayedWarningThreshold,
    QUEUE_HEALTH_DELAYED_CRITICAL_THRESHOLD:
      queueHealthDelayedCriticalThreshold,
    QUEUE_HEALTH_FAILURE_RATE_WARNING_PERCENT:
      queueHealthFailureRateWarningPercent,
    QUEUE_HEALTH_FAILURE_RATE_CRITICAL_PERCENT:
      queueHealthFailureRateCriticalPercent,
    QUEUE_HEALTH_FAILURE_RATE_MIN_SAMPLE: queueHealthFailureRateMinSample,
    QUEUE_REDIS_HOST: queueRedisHost,
    QUEUE_REDIS_PORT: queueRedisPort,
    QUEUE_REDIS_DB: queueRedisDb,
    QUEUE_REDIS_TLS: queueRedisTls,
    QUEUE_REDIS_CONNECT_TIMEOUT_MS: queueRedisConnectTimeoutMs,
    QUEUE_REDIS_MAX_RETRIES: queueRedisMaxRetries,

    SCHEDULER_ENABLED: schedulerEnabled,
    SCHEDULER_TIMEZONE: schedulerTimezone,
    SCHEDULER_MEDIA_CLEANUP_ENABLED: schedulerMediaCleanupEnabled,
    SCHEDULER_MEDIA_CLEANUP_CRON: schedulerMediaCleanupCron,
    SCHEDULER_MEDIA_CLEANUP_OLDER_THAN_MINUTES:
      schedulerMediaCleanupOlderThanMinutes,
    SCHEDULER_MEDIA_CLEANUP_DRY_RUN: schedulerMediaCleanupDryRun,
    SCHEDULER_QUEUE_HEALTH_ENABLED: schedulerQueueHealthEnabled,
    SCHEDULER_QUEUE_HEALTH_CRON: schedulerQueueHealthCron,
    SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD:
      schedulerQueueHealthFailedWarningThreshold,
  };

  syncMany(validated as Record<string, string | number>);

  return validated;
}
