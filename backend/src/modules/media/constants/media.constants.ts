export enum MediaStorageDriver {
  LOCAL = 'local',
  BUNNY = 'bunny',
}

export enum MediaFolder {
  GENERAL = 'general',
  PRODUCTS = 'products',
  BRANDS = 'brands',
  CATEGORIES = 'categories',
  USERS = 'users',
  VARIANTS = 'variants',
  BANNERS = 'banners',
  INVOICES = 'invoices',
}

export enum MediaFileKind {
  IMAGE = 'image',
  VIDEO = 'video',
  PDF = 'pdf',
  OTHER = 'other',
}

export const MEDIA_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

export const MEDIA_SVG_MIME_TYPES: readonly string[] = ['image/svg+xml'];

export const MEDIA_VIDEO_MIME_TYPES: readonly string[] = [
  'video/mp4',
  'video/webm',
];

export const MEDIA_DOCUMENT_MIME_TYPES: readonly string[] = ['application/pdf'];

export const MEDIA_MIME_EXTENSION_MAP: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
};

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return defaultValue;
}

function toPositiveNumber(
  value: string | undefined,
  defaultValue: number,
): number {
  const normalizedValue =
    typeof value === 'string' ? Number(value) : Number.NaN;

  if (Number.isFinite(normalizedValue) && normalizedValue > 0) {
    return normalizedValue;
  }

  return defaultValue;
}

function resolveStorageDriver(): MediaStorageDriver {
  const rawDriver = process.env.MEDIA_STORAGE_DRIVER?.trim().toLowerCase();

  if (rawDriver === MediaStorageDriver.BUNNY) {
    return MediaStorageDriver.BUNNY;
  }

  return MediaStorageDriver.LOCAL;
}

function readTrimmedEnv(keys: readonly string[], fallback = ''): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return fallback;
}

export const MediaConstants = {
  get MAX_FILE_SIZE_BYTES(): number {
    return toPositiveNumber(
      process.env.MEDIA_MAX_FILE_SIZE_BYTES,
      10 * 1024 * 1024,
    );
  },

  get DEFAULT_DRIVER(): MediaStorageDriver {
    return resolveStorageDriver();
  },

  get LOCAL_ROOT(): string {
    return readTrimmedEnv(
      ['MEDIA_LOCAL_ROOT', 'LOCAL_UPLOAD_DIR'],
      'public/uploads',
    );
  },

  get PUBLIC_BASE_URL(): string {
    return readTrimmedEnv(
      ['MEDIA_PUBLIC_BASE_URL', 'LOCAL_PUBLIC_BASE_URL'],
      '/uploads',
    );
  },

  get LOCAL_SERVE_ENABLED(): boolean {
    return toBoolean(process.env.MEDIA_LOCAL_SERVE_ENABLED, true);
  },

  get REQUEST_TIMEOUT_MS(): number {
    return toPositiveNumber(
      process.env.MEDIA_STORAGE_REQUEST_TIMEOUT_MS,
      15_000,
    );
  },

  get BUNNY_STORAGE_ZONE(): string {
    return readTrimmedEnv(['BUNNY_STORAGE_ZONE_NAME', 'BUNNY_STORAGE_ZONE']);
  },

  get BUNNY_STORAGE_API_KEY(): string {
    return readTrimmedEnv([
      'BUNNY_STORAGE_API_KEY',
      'BUNNY_STORAGE_ACCESS_KEY',
    ]);
  },

  get BUNNY_STORAGE_ENDPOINT(): string {
    return readTrimmedEnv(
      ['BUNNY_STORAGE_ENDPOINT', 'BUNNY_STORAGE_BASE_URL'],
      'https://storage.bunnycdn.com',
    );
  },

  get BUNNY_CDN_URL(): string {
    return readTrimmedEnv(['BUNNY_CDN_URL', 'NEXT_PUBLIC_BUNNY_CDN_URL']);
  },

  get ALLOW_SVG(): boolean {
    return toBoolean(process.env.MEDIA_ALLOW_SVG, false);
  },

  get ALLOWED_MIME_TYPES(): readonly string[] {
    const allowSvg = toBoolean(process.env.MEDIA_ALLOW_SVG, false);

    return [
      ...MEDIA_IMAGE_MIME_TYPES,
      ...(allowSvg ? MEDIA_SVG_MIME_TYPES : []),
      ...MEDIA_VIDEO_MIME_TYPES,
      ...MEDIA_DOCUMENT_MIME_TYPES,
    ];
  },
} as const;
