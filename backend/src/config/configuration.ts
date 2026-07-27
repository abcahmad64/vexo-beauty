function readEnv(keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = process.env[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return fallback;
}

function toNumber(
  value: string | undefined,
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  },
): number {
  if (value === undefined || value === null || value.trim() === '') {
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

function readNumber(
  keys: string[],
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  },
): number {
  return toNumber(readEnv(keys), fallback, options);
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readBoolean(keys: string[], fallback: boolean): boolean {
  return toBoolean(readEnv(keys), fallback);
}

function toArray(value: string | undefined, fallback: string[] = []): string[] {
  if (!value || value.trim() === '') {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readArray(keys: string[], fallback: string[] = []): string[] {
  return toArray(readEnv(keys), fallback);
}

function parseDurationDays(
  value: string | undefined,
  fallback: number,
): number {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const dayMatch = normalized.match(/^(\d+)\s*d$/);

  if (dayMatch) {
    return Number(dayMatch[1]);
  }

  return fallback;
}

export default () => {
  const nodeEnv = readEnv(['NODE_ENV'], 'development');
  const isProduction = nodeEnv === 'production';
  const isProductionLike = nodeEnv === 'production' || nodeEnv === 'staging';

  const port = readNumber(['PORT'], 3000, {
    min: 1,
    max: 65_535,
  });

  const appUrl = readEnv(['APP_URL'], `http://localhost:${port}`);

  const frontendUrl = readEnv(
    ['FRONTEND_URL'],
    isProductionLike ? 'https://vexobeauty.ir' : 'http://localhost:3000',
  );

  const corsOrigins = readArray(['CORS_ORIGINS', 'CORS_ORIGIN'], [frontendUrl]);

  const jwtRefreshExpiresIn = readEnv(
    ['JWT_REFRESH_EXPIRES_IN', 'JWT_REFRESH_TOKEN_EXPIRES_IN'],
    '30d',
  );

  const redisHost = readEnv(
    ['REDIS_HOST', 'CACHE_REDIS_HOST', 'QUEUE_REDIS_HOST'],
    'localhost',
  );

  const redisPort = readNumber(
    ['REDIS_PORT', 'CACHE_REDIS_PORT', 'QUEUE_REDIS_PORT'],
    6379,
    {
      min: 1,
      max: 65_535,
    },
  );

  const redisPassword = readEnv(
    ['REDIS_PASSWORD', 'CACHE_REDIS_PASSWORD', 'QUEUE_REDIS_PASSWORD'],
    '',
  );

  const redisTls = readBoolean(
    ['REDIS_TLS', 'CACHE_REDIS_TLS', 'QUEUE_REDIS_TLS'],
    false,
  );

  return {
    app: {
      name: readEnv(['APP_NAME'], 'VEXO Beauty Backend'),
      version: readEnv(['APP_VERSION'], '1.0.0'),
      env: nodeEnv,
      isProduction,
      isProductionLike,
      host: readEnv(['HOST'], '0.0.0.0'),
      port,
      url: appUrl,
      frontendUrl,
      apiPrefix: readEnv(['API_PREFIX'], 'api').replace(/^\/+|\/+$/g, ''),
      bodyLimit: readEnv(['BODY_LIMIT'], '10mb'),
      cors: {
        origins: corsOrigins,
        credentials: readBoolean(['CORS_CREDENTIALS'], true),
      },
    },

    auth: {
      defaultCustomerRole: readEnv(['DEFAULT_CUSTOMER_ROLE'], 'CUSTOMER'),
      jwt: {
        accessSecret: readEnv(
          ['JWT_ACCESS_SECRET', 'JWT_ACCESS_TOKEN_SECRET', 'JWT_SECRET'],
          '',
        ),
        refreshSecret: readEnv(
          ['JWT_REFRESH_SECRET', 'JWT_REFRESH_TOKEN_SECRET'],
          '',
        ),
        accessExpiresIn: readEnv(
          ['JWT_ACCESS_EXPIRES_IN', 'JWT_ACCESS_TOKEN_EXPIRES_IN'],
          '15m',
        ),
        refreshExpiresIn: jwtRefreshExpiresIn,
        refreshExpiresDays: readNumber(
          ['JWT_REFRESH_EXPIRES_DAYS'],
          parseDurationDays(jwtRefreshExpiresIn, 30),
          {
            min: 1,
            max: 365,
          },
        ),
        issuer: readEnv(['JWT_ISSUER'], 'vexo-beauty'),
        audience: readEnv(['JWT_AUDIENCE'], 'vexo-beauty-users'),
      },
      password: {
        saltRounds: readNumber(['BCRYPT_SALT_ROUNDS'], 12, {
          min: 8,
          max: 15,
        }),
        resetTokenExpiresInMinutes: readNumber(
          ['PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES'],
          30,
          {
            min: 5,
            max: 1440,
          },
        ),
      },
    },

    database: {
      url: readEnv(['DATABASE_URL'], ''),
    },

    security: {
      headers: {
        enabled: readBoolean(['SECURITY_HEADERS_ENABLED'], true),
        hstsEnabled: readBoolean(['SECURITY_HSTS_ENABLED'], isProduction),
      },
      trustProxy: readBoolean(
        ['RATE_LIMIT_TRUST_PROXY', 'TRUST_PROXY'],
        isProductionLike,
      ),
      requestIdHeader: readEnv(['REQUEST_ID_HEADER'], 'x-request-id'),
    },

    rateLimit: {
      enabled: readBoolean(['RATE_LIMIT_ENABLED'], true),
      storageDriver: readEnv(['RATE_LIMIT_STORAGE_DRIVER'], 'memory'),
      redisRequired: readBoolean(['RATE_LIMIT_REDIS_REQUIRED'], false),
      trustProxy: readBoolean(
        ['RATE_LIMIT_TRUST_PROXY', 'TRUST_PROXY'],
        isProductionLike,
      ),
      keyPrefix: readEnv(['RATE_LIMIT_KEY_PREFIX'], 'vexo:rate-limit'),
      skipPaths: readArray(['RATE_LIMIT_SKIP_PATHS'], []),
      profiles: {
        default: {
          limit: readNumber(['RATE_LIMIT_DEFAULT_LIMIT'], 120, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_DEFAULT_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_DEFAULT_BLOCK_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        public: {
          limit: readNumber(['RATE_LIMIT_PUBLIC_LIMIT'], 180, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_PUBLIC_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_PUBLIC_BLOCK_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        auth: {
          limit: readNumber(['RATE_LIMIT_AUTH_LIMIT'], 10, {
            min: 1,
            max: 10_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_AUTH_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_AUTH_BLOCK_MS'], 120_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        sensitive: {
          limit: readNumber(['RATE_LIMIT_SENSITIVE_LIMIT'], 30, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_SENSITIVE_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_SENSITIVE_BLOCK_MS'], 120_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        upload: {
          limit: readNumber(['RATE_LIMIT_UPLOAD_LIMIT'], 20, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_UPLOAD_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_UPLOAD_BLOCK_MS'], 120_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        search: {
          limit: readNumber(['RATE_LIMIT_SEARCH_LIMIT'], 60, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_SEARCH_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_SEARCH_BLOCK_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
        admin: {
          limit: readNumber(['RATE_LIMIT_ADMIN_LIMIT'], 90, {
            min: 1,
            max: 100_000,
          }),
          ttlMs: readNumber(['RATE_LIMIT_ADMIN_TTL_MS'], 60_000, {
            min: 1_000,
            max: 86_400_000,
          }),
          blockMs: readNumber(['RATE_LIMIT_ADMIN_BLOCK_MS'], 120_000, {
            min: 1_000,
            max: 86_400_000,
          }),
        },
      },
    },

    redis: {
      url: readEnv(['REDIS_URL'], ''),
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      tls: redisTls,
      db: readNumber(['REDIS_DB'], 0, {
        min: 0,
        max: 15,
      }),
      connectTimeoutMs: readNumber(['REDIS_CONNECT_TIMEOUT_MS'], 3_000, {
        min: 100,
        max: 60_000,
      }),
      maxRetries: readNumber(['REDIS_MAX_RETRIES'], 3, {
        min: 0,
        max: 20,
      }),
    },

    cache: {
      enabled: readBoolean(['CACHE_ENABLED'], true),
      keyPrefix: readEnv(['CACHE_KEY_PREFIX'], 'vexo'),
      ttlSeconds: readNumber(['CACHE_TTL_SECONDS'], 300, {
        min: 1,
        max: 86_400,
      }),
      redis: {
        enabled: readBoolean(['CACHE_REDIS_ENABLED', 'REDIS_ENABLED'], false),
        required: readBoolean(['CACHE_REDIS_REQUIRED'], false),
        url: readEnv(['CACHE_REDIS_URL', 'REDIS_URL'], ''),
        host: readEnv(['CACHE_REDIS_HOST', 'REDIS_HOST'], redisHost),
        port: readNumber(['CACHE_REDIS_PORT', 'REDIS_PORT'], redisPort, {
          min: 1,
          max: 65_535,
        }),
        password: readEnv(
          ['CACHE_REDIS_PASSWORD', 'REDIS_PASSWORD'],
          redisPassword,
        ),
        db: readNumber(['CACHE_REDIS_DB', 'REDIS_DB'], 0, {
          min: 0,
          max: 15,
        }),
        tls: readBoolean(['CACHE_REDIS_TLS', 'REDIS_TLS'], redisTls),
        connectTimeoutMs: readNumber(
          ['CACHE_REDIS_CONNECT_TIMEOUT_MS', 'REDIS_CONNECT_TIMEOUT_MS'],
          3_000,
          {
            min: 100,
            max: 60_000,
          },
        ),
        commandTimeoutMs: readNumber(
          ['CACHE_REDIS_COMMAND_TIMEOUT_MS'],
          3_000,
          {
            min: 100,
            max: 60_000,
          },
        ),
        maxRetries: readNumber(
          ['CACHE_REDIS_MAX_RETRIES', 'REDIS_MAX_RETRIES'],
          3,
          {
            min: 0,
            max: 20,
          },
        ),
      },
    },

    queue: {
      enabled: readBoolean(['QUEUE_ENABLED'], true),
      redisRequired: readBoolean(['QUEUE_REDIS_REQUIRED'], true),
      prefix: readEnv(['QUEUE_PREFIX'], 'vexo:queue'),
      defaultAttempts: readNumber(['QUEUE_DEFAULT_ATTEMPTS'], 3, {
        min: 1,
        max: 20,
      }),
      defaultBackoffDelayMs: readNumber(
        ['QUEUE_DEFAULT_BACKOFF_DELAY_MS'],
        5_000,
        {
          min: 100,
          max: 3_600_000,
        },
      ),
      defaultTimeoutMs: readNumber(['QUEUE_DEFAULT_TIMEOUT_MS'], 60_000, {
        min: 1_000,
        max: 3_600_000,
      }),
      removeOnCompleteCount: readNumber(
        ['QUEUE_REMOVE_ON_COMPLETE_COUNT'],
        1_000,
        {
          min: 1,
          max: 100_000,
        },
      ),
      removeOnFailCount: readNumber(['QUEUE_REMOVE_ON_FAIL_COUNT'], 5_000, {
        min: 1,
        max: 100_000,
      }),
      workerConcurrency: readNumber(['QUEUE_WORKER_CONCURRENCY'], 5, {
        min: 1,
        max: 100,
      }),
      stalledIntervalMs: readNumber(['QUEUE_STALLED_INTERVAL_MS'], 30_000, {
        min: 5_000,
        max: 300_000,
      }),
      maxStalledCount: readNumber(['QUEUE_MAX_STALLED_COUNT'], 1, {
        min: 0,
        max: 10,
      }),
      redis: {
        host: readEnv(['QUEUE_REDIS_HOST', 'REDIS_HOST'], redisHost),
        port: readNumber(['QUEUE_REDIS_PORT', 'REDIS_PORT'], redisPort, {
          min: 1,
          max: 65_535,
        }),
        db: readNumber(['QUEUE_REDIS_DB', 'REDIS_DB'], 0, {
          min: 0,
          max: 15,
        }),
        password: readEnv(
          ['QUEUE_REDIS_PASSWORD', 'REDIS_PASSWORD'],
          redisPassword,
        ),
        tls: readBoolean(['QUEUE_REDIS_TLS', 'REDIS_TLS'], redisTls),
        connectTimeoutMs: readNumber(
          ['QUEUE_REDIS_CONNECT_TIMEOUT_MS', 'REDIS_CONNECT_TIMEOUT_MS'],
          3_000,
          {
            min: 100,
            max: 60_000,
          },
        ),
        maxRetries: readNumber(
          ['QUEUE_REDIS_MAX_RETRIES', 'REDIS_MAX_RETRIES'],
          3,
          {
            min: 0,
            max: 20,
          },
        ),
      },
    },

    scheduler: {
      enabled: readBoolean(['SCHEDULER_ENABLED'], true),
      timezone: readEnv(['SCHEDULER_TIMEZONE'], 'Asia/Tehran'),
      mediaCleanup: {
        enabled: readBoolean(['SCHEDULER_MEDIA_CLEANUP_ENABLED'], true),
        cron: readEnv(['SCHEDULER_MEDIA_CLEANUP_CRON'], '0 * * * *'),
        olderThanMinutes: readNumber(
          ['SCHEDULER_MEDIA_CLEANUP_OLDER_THAN_MINUTES'],
          1440,
          {
            min: 1,
            max: 525_600,
          },
        ),
        dryRun: readBoolean(['SCHEDULER_MEDIA_CLEANUP_DRY_RUN'], false),
      },
      queueHealth: {
        enabled: readBoolean(['SCHEDULER_QUEUE_HEALTH_ENABLED'], true),
        cron: readEnv(['SCHEDULER_QUEUE_HEALTH_CRON'], '*/5 * * * *'),
        failedWarningThreshold: readNumber(
          ['SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD'],
          10,
          {
            min: 1,
            max: 1_000_000,
          },
        ),
      },
    },

    media: {
      driver: readEnv(['MEDIA_STORAGE_DRIVER', 'STORAGE_DRIVER'], 'local'),
      maxFileSizeBytes: readNumber(
        ['MEDIA_MAX_FILE_SIZE_BYTES'],
        10 * 1024 * 1024,
        {
          min: 1,
          max: 1024 * 1024 * 1024,
        },
      ),
      maxUploadSizeMb: readNumber(['MEDIA_MAX_UPLOAD_SIZE_MB'], 20, {
        min: 1,
        max: 1024,
      }),
      allowSvg: readBoolean(['MEDIA_ALLOW_SVG'], false),
      allowedImageMimeTypes: readArray(
        ['MEDIA_ALLOWED_IMAGE_MIME_TYPES'],
        ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      ),
      allowedVideoMimeTypes: readArray(
        ['MEDIA_ALLOWED_VIDEO_MIME_TYPES'],
        ['video/mp4', 'video/webm'],
      ),
      local: {
        root: readEnv(
          ['MEDIA_LOCAL_ROOT', 'LOCAL_UPLOAD_DIR'],
          'public/uploads',
        ),
        uploadDir: readEnv(
          ['LOCAL_UPLOAD_DIR', 'MEDIA_LOCAL_ROOT'],
          'public/uploads',
        ),
        publicBaseUrl: readEnv(
          ['MEDIA_PUBLIC_BASE_URL', 'LOCAL_PUBLIC_BASE_URL'],
          '/uploads',
        ),
        serveEnabled: readBoolean(['MEDIA_LOCAL_SERVE_ENABLED'], true),
      },
      bunny: {
        enabled: readBoolean(['BUNNY_STORAGE_ENABLED'], false),
        storageZone: readEnv(
          ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_ZONE_NAME'],
          '',
        ),
        storageZoneName: readEnv(
          ['BUNNY_STORAGE_ZONE_NAME', 'BUNNY_STORAGE_ZONE'],
          '',
        ),
        storageApiKey: readEnv(['BUNNY_STORAGE_API_KEY'], ''),
        storageEndpoint: readEnv(
          ['BUNNY_STORAGE_ENDPOINT'],
          'https://storage.bunnycdn.com',
        ),
        cdnUrl: readEnv(['BUNNY_CDN_URL', 'NEXT_PUBLIC_BUNNY_CDN_URL'], ''),
        pullZone: readEnv(['BUNNY_PULL_ZONE'], ''),
        region: readEnv(['BUNNY_STORAGE_REGION'], ''),
      },
    },

    health: {
      timeoutMs: readNumber(['HEALTH_TIMEOUT_MS'], 3_000, {
        min: 100,
        max: 60_000,
      }),
      requireRedis: readBoolean(['HEALTH_REQUIRE_REDIS'], false),
      requireStorage: readBoolean(['HEALTH_REQUIRE_STORAGE'], false),
      requireAi: readBoolean(['HEALTH_REQUIRE_AI'], false),
    },

    logging: {
      level: readEnv(['LOG_LEVEL'], isProduction ? 'info' : 'debug'),
      format: readEnv(['LOG_FORMAT'], 'json'),
      pretty: readBoolean(['LOG_PRETTY'], !isProduction),
      requestLog: {
        enabled: readBoolean(['REQUEST_LOG_ENABLED'], true),
        excludeHealth: readBoolean(['REQUEST_LOG_EXCLUDE_HEALTH'], true),
      },
      audit: {
        fileEnabled: readBoolean(['AUDIT_LOG_FILE_ENABLED'], false),
        filePath: readEnv(['AUDIT_LOG_FILE_PATH'], 'logs/audit.log'),
      },
      security: {
        fileEnabled: readBoolean(['SECURITY_LOG_FILE_ENABLED'], false),
        filePath: readEnv(['SECURITY_LOG_FILE_PATH'], 'logs/security.log'),
      },
    },

    ai: {
      enabled: readBoolean(['AI_ENABLED'], true),
      provider: readEnv(['AI_PROVIDER'], 'ollama'),
      requestTimeoutMs: readNumber(['AI_REQUEST_TIMEOUT_MS'], 240_000, {
        min: 1_000,
        max: 900_000,
      }),
      ollama: {
        think: readBoolean(['AI_OLLAMA_THINK'], false),
        baseUrl: readEnv(
          ['AI_OLLAMA_BASE_URL', 'OLLAMA_BASE_URL'],
          'http://127.0.0.1:11434',
        ),
        defaultModel: readEnv(
          ['AI_OLLAMA_DEFAULT_MODEL', 'OLLAMA_MODEL'],
          'qwen3.5:9b',
        ),
        publicModel: readEnv(['AI_OLLAMA_PUBLIC_MODEL'], 'qwen3.5:9b'),
        consultingModel: readEnv(['AI_OLLAMA_CONSULTING_MODEL'], 'qwen3.5:9b'),
        salesModel: readEnv(['AI_OLLAMA_SALES_MODEL'], 'qwen3.5:9b'),
        contentModel: readEnv(['AI_OLLAMA_CONTENT_MODEL'], 'qwen3.5:9b'),
        seoModel: readEnv(['AI_OLLAMA_SEO_MODEL'], 'qwen3.5:9b'),
        smsModel: readEnv(['AI_OLLAMA_SMS_MODEL'], 'qwen3.5:9b'),
        bannerTextModel: readEnv(['AI_OLLAMA_BANNER_TEXT_MODEL'], 'qwen3.5:9b'),
        recommendationModel: readEnv(
          ['AI_OLLAMA_RECOMMENDATION_MODEL'],
          'qwen3.5:9b',
        ),
        comparisonModel: readEnv(['AI_OLLAMA_COMPARISON_MODEL'], 'qwen3.5:9b'),
        embeddingModel: readEnv(
          ['AI_OLLAMA_EMBEDDING_MODEL'],
          'qwen3-embedding:4b',
        ),
        analyticsModel: readEnv(
          ['AI_OLLAMA_ANALYTICS_MODEL'],
          'deepseek-r1:14b',
        ),
        marketingStrategyModel: readEnv(
          ['AI_OLLAMA_MARKETING_STRATEGY_MODEL'],
          'deepseek-r1:14b',
        ),
        discountModel: readEnv(['AI_OLLAMA_DISCOUNT_MODEL'], 'deepseek-r1:14b'),
        adminReportModel: readEnv(
          ['AI_OLLAMA_ADMIN_REPORT_MODEL'],
          'deepseek-r1:14b',
        ),
        demandAnalysisModel: readEnv(
          ['AI_OLLAMA_DEMAND_ANALYSIS_MODEL'],
          'deepseek-r1:14b',
        ),
        visionModel: readEnv(['AI_OLLAMA_VISION_MODEL'], 'gemma4:12b'),
        altTextModel: readEnv(['AI_OLLAMA_ALT_TEXT_MODEL'], 'gemma4:12b'),
        imageDescriptionModel: readEnv(
          ['AI_OLLAMA_IMAGE_DESCRIPTION_MODEL'],
          'gemma4:12b',
        ),
        fallbackModel: readEnv(['AI_OLLAMA_FALLBACK_MODEL'], 'llama3.1:8b'),
        timeoutMs: readNumber(
          ['AI_OLLAMA_TIMEOUT_MS', 'OLLAMA_TIMEOUT_MS'],
          180_000,
          {
            min: 1_000,
            max: 900_000,
          },
        ),
        keepAlive: readEnv(['AI_OLLAMA_KEEP_ALIVE'], '30m'),
        numCtx: readNumber(['AI_OLLAMA_NUM_CTX'], 4096, {
          min: 512,
          max: 262_144,
        }),
        numPredict: readNumber(['AI_OLLAMA_NUM_PREDICT'], 512, {
          min: 1,
          max: 32_768,
        }),
        longNumPredict: readNumber(['AI_OLLAMA_LONG_NUM_PREDICT'], 2048, {
          min: 1,
          max: 65_536,
        }),
        temperature: Number(readEnv(['AI_OLLAMA_TEMPERATURE'], '0.4')),
        preciseTemperature: Number(
          readEnv(['AI_OLLAMA_PRECISE_TEMPERATURE'], '0.35'),
        ),
        creativeTemperature: Number(
          readEnv(['AI_OLLAMA_CREATIVE_TEMPERATURE'], '0.55'),
        ),
      },
    },

    swagger: {
      enabled: readBoolean(['SWAGGER_ENABLED'], !isProduction),
      path: readEnv(['SWAGGER_PATH'], 'docs'),
      jsonPath: readEnv(['SWAGGER_JSON_PATH'], 'docs-json'),
      yamlPath: readEnv(['SWAGGER_YAML_PATH'], 'docs-yaml'),
      title: readEnv(['SWAGGER_TITLE'], 'VEXO Beauty Backend API'),
      description: readEnv(
        ['SWAGGER_DESCRIPTION'],
        'Production-ready ecommerce backend API for VEXO Beauty.',
      ),
      version: readEnv(['SWAGGER_VERSION', 'APP_VERSION'], '1.0.0'),
      serverUrl: readEnv(['SWAGGER_SERVER_URL'], appUrl),
      bearerAuthName: readEnv(['SWAGGER_BEARER_AUTH_NAME'], 'access-token'),
      persistAuthorization: readBoolean(
        ['SWAGGER_PERSIST_AUTHORIZATION'],
        true,
      ),
      explorer: readBoolean(['SWAGGER_EXPLORER'], true),
    },

    notification: {
      enabled: readBoolean(['NOTIFICATION_ENABLED'], true),
      channels: {
        database: readBoolean(['NOTIFICATION_DATABASE_ENABLED'], true),
        email: readBoolean(
          ['NOTIFICATION_EMAIL_ENABLED', 'EMAIL_ENABLED'],
          false,
        ),
        sms: readBoolean(['NOTIFICATION_SMS_ENABLED', 'SMS_ENABLED'], false),
        push: readBoolean(['NOTIFICATION_PUSH_ENABLED', 'PUSH_ENABLED'], false),
      },
      defaults: {
        senderName: readEnv(['NOTIFICATION_SENDER_NAME'], 'فروشگاه وکسو بیوتی'),
        senderEmail: readEnv(['NOTIFICATION_SENDER_EMAIL'], ''),
        supportEmail: readEnv(['SUPPORT_EMAIL'], ''),
        supportPhone: readEnv(['SUPPORT_PHONE'], ''),
      },
      userEmailColumn: readEnv(['NOTIFICATION_USER_EMAIL_COLUMN'], 'email'),
      userPhoneColumn: readEnv(['NOTIFICATION_USER_PHONE_COLUMN'], 'phone'),
      websocketNamespace: readEnv(
        ['NOTIFICATION_WEBSOCKET_NAMESPACE'],
        'notifications',
      ),
    },

    mail: {
      enabled: readBoolean(['MAIL_ENABLED', 'EMAIL_ENABLED'], false),
      host: readEnv(['MAIL_HOST', 'SMTP_HOST'], ''),
      port: readNumber(['MAIL_PORT', 'SMTP_PORT'], 587, {
        min: 1,
        max: 65_535,
      }),
      secure: readBoolean(['MAIL_SECURE', 'SMTP_SECURE'], false),
      user: readEnv(['MAIL_USER', 'SMTP_USER'], ''),
      password: readEnv(['MAIL_PASSWORD', 'SMTP_PASSWORD'], ''),
      fromName: readEnv(['MAIL_FROM_NAME', 'SMTP_FROM_NAME'], 'VEXO Beauty'),
      fromEmail: readEnv(
        ['MAIL_FROM_EMAIL', 'SMTP_FROM_ADDRESS'],
        'no-reply@vexo-beauty.local',
      ),
    },

    email: {
      enabled: readBoolean(['EMAIL_ENABLED', 'MAIL_ENABLED'], false),
      smtp: {
        host: readEnv(['SMTP_HOST', 'MAIL_HOST'], ''),
        port: readNumber(['SMTP_PORT', 'MAIL_PORT'], 587, {
          min: 1,
          max: 65_535,
        }),
        secure: readBoolean(['SMTP_SECURE', 'MAIL_SECURE'], false),
        user: readEnv(['SMTP_USER', 'MAIL_USER'], ''),
        password: readEnv(['SMTP_PASSWORD', 'MAIL_PASSWORD'], ''),
      },
      from: {
        address: readEnv(
          ['SMTP_FROM_ADDRESS', 'MAIL_FROM_EMAIL'],
          'no-reply@vexo-beauty.local',
        ),
        name: readEnv(['SMTP_FROM_NAME', 'MAIL_FROM_NAME'], 'VEXO Beauty'),
      },
    },

    sms: {
      enabled: readBoolean(['SMS_ENABLED'], false),
      provider: readEnv(['SMS_PROVIDER', 'SMS_PROVIDER_NAME'], 'generic-http'),
      apiKey: readEnv(['SMS_API_KEY'], ''),
      sender: readEnv(['SMS_SENDER'], ''),
      providerUrl: readEnv(['SMS_PROVIDER_URL'], ''),
      providerToken: readEnv(['SMS_PROVIDER_TOKEN'], ''),
      providerTokenHeader: readEnv(
        ['SMS_PROVIDER_TOKEN_HEADER'],
        'Authorization',
      ),
      providerTokenPrefix: readEnv(['SMS_PROVIDER_TOKEN_PREFIX'], 'Bearer'),
      recipientField: readEnv(['SMS_PROVIDER_RECIPIENT_FIELD'], 'to'),
      messageField: readEnv(['SMS_PROVIDER_MESSAGE_FIELD'], 'message'),
      templateField: readEnv(['SMS_PROVIDER_TEMPLATE_FIELD'], 'template'),
      httpTimeoutMs: readNumber(['SMS_HTTP_TIMEOUT_MS'], 10_000, {
        min: 1_000,
        max: 120_000,
      }),
    },

    push: {
      enabled: readBoolean(['PUSH_ENABLED'], false),
      vapid: {
        publicKey: readEnv(['VAPID_PUBLIC_KEY'], ''),
        privateKey: readEnv(['VAPID_PRIVATE_KEY'], ''),
        subject: readEnv(
          ['VAPID_SUBJECT'],
          'mailto:no-reply@vexo-beauty.local',
        ),
      },
    },

    invoice: {
      pdfStorageRoot: readEnv(['INVOICE_PDF_STORAGE_ROOT'], 'storage/invoices'),
      pdfPublicBasePath: readEnv(['INVOICE_PDF_PUBLIC_BASE_PATH'], '/invoices'),
      browserExecutablePath: readEnv(
        ['INVOICE_PDF_BROWSER_EXECUTABLE_PATH'],
        '',
      ),
      company: {
        name: readEnv(['INVOICE_COMPANY_NAME'], 'VEXO Beauty'),
        legalName: readEnv(
          ['INVOICE_COMPANY_LEGAL_NAME'],
          'فروشگاه اینترنتی وکسو بیوتی',
        ),
        phone: readEnv(['INVOICE_COMPANY_PHONE'], ''),
        email: readEnv(['INVOICE_COMPANY_EMAIL'], 'support@vexo-beauty.local'),
        website: readEnv(['INVOICE_COMPANY_WEBSITE'], 'vexo-beauty.local'),
        address: readEnv(['INVOICE_COMPANY_ADDRESS'], ''),
        taxId: readEnv(['INVOICE_COMPANY_TAX_ID'], ''),
        economicCode: readEnv(['INVOICE_COMPANY_ECONOMIC_CODE'], ''),
      },
    },

    payment: {
      defaultCurrency: readEnv(['DEFAULT_CURRENCY'], 'IRR'),
      gateway: readEnv(['PAYMENT_GATEWAY'], 'zarinpal'),
      callbackUrl: readEnv(
        ['PAYMENT_CALLBACK_URL', 'ZARINPAL_CALLBACK_URL'],
        '',
      ),
      sandbox: readBoolean(['PAYMENT_SANDBOX', 'ZARINPAL_SANDBOX'], true),
      successRedirectUrl: readEnv(
        ['PAYMENT_SUCCESS_REDIRECT_URL'],
        `${frontendUrl}/payment/success`,
      ),
      failureRedirectUrl: readEnv(
        ['PAYMENT_FAILURE_REDIRECT_URL'],
        `${frontendUrl}/payment/failure`,
      ),
      receiptBaseUrl: readEnv(['PAYMENT_RECEIPT_BASE_URL'], ''),
      zarinpal: {
        merchantId: readEnv(['ZARINPAL_MERCHANT_ID'], ''),
        sandbox: readBoolean(['ZARINPAL_SANDBOX'], true),
        callbackUrl: readEnv(['ZARINPAL_CALLBACK_URL'], ''),
        httpTimeoutMs: readNumber(['ZARINPAL_HTTP_TIMEOUT_MS'], 15_000, {
          min: 1_000,
          max: 120_000,
        }),
      },
    },

    shipment: {
      defaultCountry: readEnv(['SHIPMENT_DEFAULT_COUNTRY'], 'IR'),
      trackingBaseUrl: readEnv(['SHIPMENT_TRACKING_BASE_URL'], ''),
    },

    adminOperations: {
      digestScheduleEnabled: readBoolean(
        ['ADMIN_OPERATIONS_DIGEST_SCHEDULE_ENABLED'],
        true,
      ),
      watchdogEnabled: readBoolean(['ADMIN_OPERATIONS_WATCHDOG_ENABLED'], true),
      alertEscalationEnabled: readBoolean(
        ['ADMIN_OPERATIONS_ALERT_ESCALATION_ENABLED'],
        true,
      ),
    },
  };
};
