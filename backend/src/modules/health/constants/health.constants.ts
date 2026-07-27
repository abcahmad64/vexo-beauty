export const HEALTH_STATUS = {
  UP: 'سالم',
  DOWN: 'ناسالم',
  DEGRADED: 'تخریب‌شده',
} as const;

export const HEALTH_DEPENDENCY_NAMES = {
  DATABASE: 'database',
  REDIS: 'redis',
  QUEUE: 'queue',
  STORAGE: 'storage',
  AI: 'ai',
} as const;

export const HEALTH_DEPENDENCY_LABELS = {
  DATABASE: 'پایگاه داده',
  REDIS: 'ردیس',
  QUEUE: 'صف پردازش',
  STORAGE: 'فضای ذخیره‌سازی',
  AI: 'هوش مصنوعی',
} as const;

export const HEALTH_DEFAULT_TIMEOUT_MS = 3000;

export const HEALTH_SERVICE_NAME = 'VEXO Beauty Backend';

export const HEALTH_DEFAULT_AI_MODEL = 'qwen3-coder:30b';

export const HEALTH_DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export const HEALTH_BUNNY_DEFAULT_STORAGE_HOST = 'storage.bunnycdn.com';
