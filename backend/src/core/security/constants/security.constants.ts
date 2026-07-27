export const SECURITY_HEADERS = {
  X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  X_FRAME_OPTIONS: 'X-Frame-Options',
  REFERRER_POLICY: 'Referrer-Policy',
  PERMISSIONS_POLICY: 'Permissions-Policy',
  X_PERMITTED_CROSS_DOMAIN_POLICIES: 'X-Permitted-Cross-Domain-Policies',
  CROSS_ORIGIN_OPENER_POLICY: 'Cross-Origin-Opener-Policy',
  CROSS_ORIGIN_RESOURCE_POLICY: 'Cross-Origin-Resource-Policy',
  STRICT_TRANSPORT_SECURITY: 'Strict-Transport-Security',
  X_XSS_PROTECTION: 'X-XSS-Protection',
} as const;

export type SecurityHeaderName =
  (typeof SECURITY_HEADERS)[keyof typeof SECURITY_HEADERS];

export const SECURITY_HEADER_VALUES = {
  NOSNIFF: 'nosniff',
  DENY: 'DENY',
  NO_REFERRER: 'no-referrer',
  PERMISSIONS_POLICY:
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  NONE: 'none',
  SAME_ORIGIN: 'same-origin',
  SAME_SITE: 'same-site',
  CROSS_ORIGIN: 'cross-origin',
  HSTS_ONE_YEAR_INCLUDE_SUBDOMAINS: 'max-age=31536000; includeSubDomains',
  DISABLE_XSS_AUDITOR: '0',
} as const;

export type CrossOriginResourcePolicy =
  | typeof SECURITY_HEADER_VALUES.SAME_ORIGIN
  | typeof SECURITY_HEADER_VALUES.SAME_SITE
  | typeof SECURITY_HEADER_VALUES.CROSS_ORIGIN;

export const SECURITY_MESSAGES = {
  AUTH_REQUIRED: 'برای انجام این عملیات باید وارد حساب کاربری شوید.',
  INVALID_TOKEN: 'توکن احراز هویت معتبر نیست.',
  TOKEN_EXPIRED: 'نشست شما منقضی شده است. دوباره وارد حساب کاربری شوید.',
  INVALID_REFRESH_TOKEN: 'توکن تمدید نشست معتبر نیست.',
  SESSION_NOT_FOUND: 'نشست کاربری یافت نشد.',
  SESSION_EXPIRED: 'نشست کاربری منقضی شده است.',
  SESSION_REVOKED: 'نشست کاربری لغو شده است.',

  INVALID_CREDENTIALS: 'اطلاعات ورود معتبر نیست.',
  USER_NOT_FOUND_OR_INACTIVE: 'کاربر یافت نشد یا حساب کاربری غیرفعال است.',
  USER_INACTIVE: 'حساب کاربری غیرفعال است.',

  OTP_REQUIRED: 'کد تأیید الزامی است.',
  OTP_INVALID: 'کد تأیید معتبر نیست.',
  OTP_EXPIRED: 'کد تأیید منقضی شده است.',
  OTP_RATE_LIMITED:
    'درخواست کد تأیید بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',

  ROLE_REQUIRED: 'نقش کاربری برای انجام این عملیات لازم است.',
  ROLE_FORBIDDEN: 'شما نقش لازم برای انجام این عملیات را ندارید.',
  PERMISSION_FORBIDDEN: 'شما مجوز کافی برای انجام این عملیات را ندارید.',

  ACCESS_DENIED: 'دسترسی به این بخش مجاز نیست.',
  ACCOUNT_LOCKED: 'حساب کاربری موقتاً محدود شده است.',
  SUSPICIOUS_ACTIVITY: 'فعالیت مشکوک شناسایی شد.',
} as const;

export type SecurityMessageKey = keyof typeof SECURITY_MESSAGES;
