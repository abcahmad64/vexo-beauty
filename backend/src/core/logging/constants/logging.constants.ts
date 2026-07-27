export const LOG_LEVEL_PRIORITY = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
} as const;

export type LogLevel = keyof typeof LOG_LEVEL_PRIORITY;

export const DEFAULT_LOG_LEVEL_BY_ENV = {
  production: 'log',
  staging: 'debug',
  test: 'warn',
  development: 'debug',
} as const satisfies Readonly<Record<string, LogLevel>>;

export const LOG_FORMAT = {
  JSON: 'json',
  PRETTY: 'pretty',
} as const;

export type LogFormat = (typeof LOG_FORMAT)[keyof typeof LOG_FORMAT];

export const LOG_CONTEXT = {
  BOOTSTRAP: 'Bootstrap',
  REQUEST: 'RequestLogger',
  AUDIT: 'AuditLogger',
  SECURITY: 'SecurityLogger',
  SYSTEM: 'System',
} as const;

export const SENSITIVE_LOG_FIELDS = [
  'password',
  'pass',
  'passwordHash',
  'currentPassword',
  'newPassword',

  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'apiKey',
  'apikey',
  'accessKey',
  'privateKey',
  'jwt',
  'session',
  'sessionId',

  'otp',
  'otpCode',
  'verificationCode',
  'smsCode',
  'emailCode',

  'phone',
  'mobile',
  'email',
  'nationalCode',
  'idNumber',
  'cardNumber',
  'iban',
  'sheba',
] as const;

export const REDACTED_VALUE = '[REDACTED]';

export const DEFAULT_LOG_FILE_DIRECTORY = 'logs';

export const DEFAULT_AUDIT_LOG_FILE = 'logs/audit.log';

export const DEFAULT_SECURITY_LOG_FILE = 'logs/security.log';
