import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { json, static as serveStatic, urlencoded } from 'express';
import helmet from 'helmet';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';

import { AppModule } from './app.module';
import { validationErrorFactory } from './core/errors/validation-error.factory';
import { StructuredLoggerService } from './core/logging/services/structured-logger.service';
import { setupSwagger } from './core/swagger/swagger.config';

type CorsOrigin = boolean | string[];

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .map(normalizeOriginValue);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeOriginValue);
  }

  return [];
}

function normalizeOriginValue(value: string): string {
  if (value === '*') {
    return value;
  }

  return value.replace(/\/+$/g, '');
}

function isProductionLike(nodeEnv: string): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

function resolveCorsOrigin(
  origins: unknown,
  nodeEnv: string,
  fallbackOrigin: string,
): CorsOrigin {
  const normalizedOrigins = [...new Set(normalizeStringArray(origins))];

  if (normalizedOrigins.length === 0) {
    if (isProductionLike(nodeEnv)) {
      throw new Error('CORS origins are required in production/staging.');
    }

    return [normalizeOriginValue(fallbackOrigin)];
  }

  if (normalizedOrigins.includes('*')) {
    if (isProductionLike(nodeEnv)) {
      throw new Error('CORS origin "*" is not allowed in production/staging.');
    }

    return true;
  }

  if (
    isProductionLike(nodeEnv) &&
    normalizedOrigins.some((origin) => origin.includes('localhost'))
  ) {
    throw new Error(
      'Localhost CORS origins are not allowed in production/staging.',
    );
  }

  return normalizedOrigins;
}

function getFirstConfigValue(
  configService: ConfigService,
  keys: readonly string[],
  defaultValue: string,
): string {
  for (const key of keys) {
    const value = configService.get<string>(key);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return defaultValue;
}

function getStringArrayConfig(
  configService: ConfigService,
  keys: readonly string[],
  defaultValue: string[],
): string[] {
  for (const key of keys) {
    const value = configService.get<unknown>(key);
    const normalized = normalizeStringArray(value);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return defaultValue;
}

function getBooleanConfig(
  configService: ConfigService,
  keys: readonly string[],
  defaultValue: boolean,
): boolean {
  for (const key of keys) {
    const value = configService.get<boolean | string>(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim().toLowerCase();

      if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
        return true;
      }

      if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
        return false;
      }
    }
  }

  return defaultValue;
}

function normalizePublicMountPath(value: string): string {
  const normalizedValue = value.trim().replace(/\\/g, '/').replace(/\/+$/g, '');

  if (!normalizedValue) {
    return '/uploads';
  }

  return normalizedValue.startsWith('/')
    ? normalizedValue
    : `/${normalizedValue}`;
}

function configureLocalMediaServing(
  app: INestApplication,
  configService: ConfigService,
  logger: StructuredLoggerService,
  isProductionLikeEnvironment: boolean,
): void {
  const storageDriver = getFirstConfigValue(
    configService,
    ['MEDIA_STORAGE_DRIVER', 'media.driver', 'media.storageDriver'],
    'local',
  ).toLowerCase();

  const localServeEnabled = getBooleanConfig(
    configService,
    [
      'MEDIA_LOCAL_SERVE_ENABLED',
      'media.local.serveEnabled',
      'media.localServeEnabled',
    ],
    true,
  );

  if (storageDriver !== 'local' || !localServeEnabled) {
    return;
  }

  const localRoot = getFirstConfigValue(
    configService,
    ['MEDIA_LOCAL_ROOT', 'media.local.root', 'media.localRoot'],
    'public/uploads',
  );

  const publicBaseUrl = normalizePublicMountPath(
    getFirstConfigValue(
      configService,
      [
        'MEDIA_PUBLIC_BASE_URL',
        'media.local.publicBaseUrl',
        'media.publicBaseUrl',
      ],
      '/uploads',
    ),
  );

  const absoluteRoot = resolve(process.cwd(), localRoot);

  app.use(
    publicBaseUrl,
    serveStatic(absoluteRoot, {
      index: false,
      dotfiles: 'deny',
      etag: true,
      fallthrough: true,
      immutable: isProductionLikeEnvironment,
      maxAge: isProductionLikeEnvironment ? '7d' : '1h',
      setHeaders: (response: ServerResponse): void => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  logger.write({
    level: 'log',
    context: 'Upload',
    message: `Static upload serving فعال شد: ${publicBaseUrl}`,
    metadata: {
      publicBaseUrl,
      localRoot,
      absoluteRoot,
    },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: false,
  });

  const logger = app.get(StructuredLoggerService);

  app.useLogger(logger);
  app.enableShutdownHooks();

  useContainer(app.select(AppModule), {
    fallbackOnErrors: true,
  });

  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port', 3000);
  const host = configService.get<string>('app.host', '0.0.0.0');
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const bodyLimit = configService.get<string>('app.bodyLimit', '10mb');
  const nodeEnv = configService.get<string>(
    'app.env',
    process.env.NODE_ENV ?? 'development',
  );
  const frontendUrl = configService.get<string>(
    'app.frontendUrl',
    'http://localhost:3000',
  );

  const isProductionLikeEnvironment = isProductionLike(nodeEnv);
  const securityHeadersEnabled = getBooleanConfig(
    configService,
    ['security.headers.enabled', 'SECURITY_HEADERS_ENABLED'],
    true,
  );
  const hstsEnabled = getBooleanConfig(
    configService,
    ['security.headers.hstsEnabled', 'SECURITY_HSTS_ENABLED'],
    isProductionLikeEnvironment,
  );

  if (securityHeadersEnabled) {
    app.use(
      helmet({
        contentSecurityPolicy: isProductionLikeEnvironment ? undefined : false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: {
          policy: 'same-origin',
        },
        hsts: hstsEnabled
          ? {
              maxAge: 31_536_000,
              includeSubDomains: true,
            }
          : false,
        hidePoweredBy: true,
        noSniff: true,
        referrerPolicy: {
          policy: 'no-referrer',
        },
        frameguard: {
          action: 'deny',
        },
      }),
    );
  }

  configureLocalMediaServing(
    app,
    configService,
    logger,
    isProductionLikeEnvironment,
  );

  app.use(
    json({
      limit: bodyLimit,
    }),
  );

  app.use(
    urlencoded({
      extended: true,
      limit: bodyLimit,
    }),
  );

  const corsOrigins = getStringArrayConfig(
    configService,
    ['app.cors.origins', 'app.corsOrigins', 'CORS_ORIGINS'],
    [frontendUrl],
  );

  const corsCredentials = getBooleanConfig(
    configService,
    ['app.cors.credentials', 'app.corsCredentials', 'CORS_CREDENTIALS'],
    true,
  );

  app.enableCors({
    origin: resolveCorsOrigin(corsOrigins, nodeEnv, frontendUrl),
    credentials: corsCredentials,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Accept',
      'Authorization',
      'Content-Type',
      'Origin',
      'X-Requested-With',
      'X-Request-Id',
      'X-Correlation-Id',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-Correlation-Id',
      'X-Total-Count',
      'X-Page',
      'X-Limit',
    ],
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
      forbidUnknownValues: false,
      exceptionFactory: validationErrorFactory,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix, {
      exclude: [
        {
          path: '',
          method: RequestMethod.GET,
        },
        {
          path: 'health',
          method: RequestMethod.GET,
        },
        {
          path: 'health/liveness',
          method: RequestMethod.GET,
        },
        {
          path: 'health/readiness',
          method: RequestMethod.GET,
        },
        {
          path: 'health/version',
          method: RequestMethod.GET,
        },
        {
          path: 'health/dependencies',
          method: RequestMethod.GET,
        },
        {
          path: 'health/database',
          method: RequestMethod.GET,
        },
        {
          path: 'health/redis',
          method: RequestMethod.GET,
        },
        {
          path: 'health/queue',
          method: RequestMethod.GET,
        },
        {
          path: 'health/storage',
          method: RequestMethod.GET,
        },
        {
          path: 'health/ai',
          method: RequestMethod.GET,
        },
      ],
    });
  }

  const versioningEnabled = configService.get<boolean>(
    'app.versioning.enabled',
    false,
  );

  if (versioningEnabled) {
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: configService.get<string>(
        'app.versioning.defaultVersion',
        '1',
      ),
    });
  }

  const swagger = setupSwagger(app, configService, logger);

  await app.listen(port, host);

  const appUrl = await app.getUrl();

  logger.write({
    level: 'log',
    context: 'Bootstrap',
    message: `Application is running on ${appUrl}`,
  });

  logger.write({
    level: 'log',
    context: 'Bootstrap',
    message: `Environment: ${nodeEnv}`,
  });

  logger.write({
    level: 'log',
    context: 'Bootstrap',
    message: `API prefix: ${apiPrefix || 'none'}`,
  });

  logger.write({
    level: 'log',
    context: 'Bootstrap',
    message: `CORS origins: ${corsOrigins.join(', ')}`,
  });

  if (swagger.enabled) {
    logger.write({
      level: 'log',
      context: 'Bootstrap',
      message: `Swagger docs: ${appUrl}/${swagger.path}`,
    });

    logger.write({
      level: 'log',
      context: 'Bootstrap',
      message: `Swagger JSON: ${appUrl}/${swagger.jsonPath}`,
    });
  }
}

void bootstrap();
