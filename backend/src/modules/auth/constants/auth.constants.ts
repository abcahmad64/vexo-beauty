type AuthEnvironment = 'development' | 'test' | 'staging' | 'production';

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_TOKEN_EXPIRES_DAYS = 30;
const DEFAULT_CUSTOMER_ROLE = 'CUSTOMER';
const PASSWORD_MIN_LENGTH = 8;
const MIN_SECRET_LENGTH = 32;

function getNodeEnv(): AuthEnvironment {
  const value = process.env.NODE_ENV;

  if (
    value === 'production' ||
    value === 'staging' ||
    value === 'test' ||
    value === 'development'
  ) {
    return value;
  }

  return 'development';
}

function isProductionLike(): boolean {
  const env = getNodeEnv();

  return env === 'production' || env === 'staging';
}

function getRequiredSecret(primaryKey: string, fallbackKey: string): string {
  const value =
    process.env[primaryKey]?.trim() || process.env[fallbackKey]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${primaryKey}. ` +
        `Set ${primaryKey} or ${fallbackKey} before starting the backend.`,
    );
  }

  if (isProductionLike() && value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${primaryKey} must be at least ${MIN_SECRET_LENGTH} characters in production/staging.`,
    );
  }

  return value;
}

function getPositiveInteger(key: string, fallback: number): number {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue === null || rawValue.trim() === '') {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
}

function getString(key: string, fallback: string): string {
  const value = process.env[key]?.trim();

  return value && value.length > 0 ? value : fallback;
}

export const AuthConstants = {
  get ACCESS_TOKEN_EXPIRES_IN(): string {
    return getString('JWT_ACCESS_EXPIRES_IN', DEFAULT_ACCESS_TOKEN_EXPIRES_IN);
  },

  get REFRESH_TOKEN_EXPIRES_DAYS(): number {
    return getPositiveInteger(
      'JWT_REFRESH_EXPIRES_DAYS',
      DEFAULT_REFRESH_TOKEN_EXPIRES_DAYS,
    );
  },

  get ACCESS_SECRET(): string {
    return getRequiredSecret('JWT_ACCESS_SECRET', 'JWT_SECRET');
  },

  get REFRESH_SECRET(): string {
    return getRequiredSecret('JWT_REFRESH_SECRET', 'JWT_SECRET');
  },

  get DEFAULT_CUSTOMER_ROLE(): string {
    return getString('DEFAULT_CUSTOMER_ROLE', DEFAULT_CUSTOMER_ROLE);
  },

  PASSWORD_MIN_LENGTH,
} as const;
