export const CORE_METADATA_KEYS = {
  IS_PUBLIC: 'isPublic',
  SKIP_RESPONSE_WRAP: 'skipResponseWrap',
} as const;

export type CoreMetadataKey =
  (typeof CORE_METADATA_KEYS)[keyof typeof CORE_METADATA_KEYS];

export const REQUEST_HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
} as const;

export type RequestHeaderName =
  (typeof REQUEST_HEADERS)[keyof typeof REQUEST_HEADERS];

export const DEFAULT_API_MESSAGES = {
  SUCCESS: 'درخواست با موفقیت انجام شد.',
  CREATED: 'اطلاعات با موفقیت ثبت شد.',
  UPDATED: 'اطلاعات با موفقیت به‌روزرسانی شد.',
  DELETED: 'اطلاعات با موفقیت حذف شد.',

  NOT_FOUND: 'اطلاعات موردنظر یافت نشد.',
  BAD_REQUEST: 'اطلاعات ارسال‌شده معتبر نیست.',
  VALIDATION_ERROR: 'اطلاعات ارسال‌شده معتبر نیست.',
  UNAUTHORIZED: 'برای انجام این عملیات باید وارد حساب کاربری شوید.',
  FORBIDDEN: 'شما مجوز انجام این عملیات را ندارید.',
  CONFLICT: 'این اطلاعات قبلاً ثبت شده است.',
  TOO_MANY_REQUESTS: 'تعداد درخواست‌ها بیش از حد مجاز است.',
  REQUEST_TIMEOUT: 'زمان پاسخ‌دهی سرویس بیش از حد مجاز شد.',
  SERVICE_UNAVAILABLE: 'سرویس در حال حاضر در دسترس نیست.',
  INTERNAL_ERROR: 'خطای داخلی سرور رخ داده است.',
} as const;

export type DefaultApiMessageKey = keyof typeof DEFAULT_API_MESSAGES;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const DEFAULT_TIMEOUTS = {
  HTTP_REQUEST_MS: 30_000,
  LONG_REQUEST_MS: 300_000,
  UPLOAD_REQUEST_MS: 300_000,
  MEDIA_REQUEST_MS: 300_000,
  AI_REQUEST_MS: 240_000,
} as const;
