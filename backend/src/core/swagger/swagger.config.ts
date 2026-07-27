import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type SwaggerCustomOptions,
} from '@nestjs/swagger';

import type { StructuredLoggerService } from '../logging/services/structured-logger.service';
import {
  SWAGGER_API_TAGS,
  SWAGGER_AUTH_NAME,
  SWAGGER_DEFAULT_JSON_PATH,
  SWAGGER_DEFAULT_PATH,
  SWAGGER_DEFAULT_YAML_PATH,
} from './swagger.constants';
import type { SwaggerRuntimeConfig, SwaggerSetupResult } from './swagger.types';

type ConfigPrimitive = string | number | boolean;

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
  logger?: StructuredLoggerService,
): SwaggerSetupResult {
  const config = resolveSwaggerConfig(configService);

  if (!config.enabled) {
    logger?.write({
      level: 'log',
      context: 'Swagger',
      message: 'Swagger غیرفعال است.',
    });

    return {
      enabled: false,
      path: config.path,
      jsonPath: config.jsonPath,
      yamlPath: config.yamlPath,
    };
  }

  const document = createSwaggerDocument(app, config);
  const customOptions = createSwaggerCustomOptions(config);

  SwaggerModule.setup(config.path, app, document, customOptions);

  logger?.write({
    level: 'log',
    context: 'Swagger',
    message: `Swagger فعال شد: /${config.path}`,
    metadata: {
      path: `/${config.path}`,
      jsonPath: `/${config.jsonPath}`,
      yamlPath: `/${config.yamlPath}`,
      serverUrl: config.serverUrl,
    },
  });

  return {
    enabled: true,
    path: config.path,
    jsonPath: config.jsonPath,
    yamlPath: config.yamlPath,
  };
}

function createSwaggerDocument(
  app: INestApplication,
  config: SwaggerRuntimeConfig,
): OpenAPIObject {
  let documentBuilder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .addServer(config.serverUrl, 'آدرس اصلی API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'توکن دسترسی JWT را بدون عبارت Bearer وارد کنید. Swagger به‌صورت خودکار Bearer را اضافه می‌کند.',
        in: 'header',
      },
      config.bearerAuthName,
    );

  for (const tag of SWAGGER_API_TAGS) {
    documentBuilder = documentBuilder.addTag(tag.name, tag.description);
  }

  const swaggerConfig = documentBuilder.build();

  return SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
    ignoreGlobalPrefix: false,
    operationIdFactory: (controllerKey: string, methodKey: string): string =>
      `${controllerKey}_${methodKey}`,
  });
}

function createSwaggerCustomOptions(
  config: SwaggerRuntimeConfig,
): SwaggerCustomOptions {
  return {
    useGlobalPrefix: false,
    explorer: config.explorer,
    jsonDocumentUrl: config.jsonPath,
    yamlDocumentUrl: config.yamlPath,
    customSiteTitle: config.title,
    swaggerOptions: {
      persistAuthorization: config.persistAuthorization,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      tryItOutEnabled: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customCss: [
      '.swagger-ui .topbar { display: none }',
      '.swagger-ui .info { margin: 32px 0 }',
      '.swagger-ui .info .title { font-size: 32px }',
      '.swagger-ui .scheme-container { border-radius: 12px }',
    ].join('\n'),
  };
}

function resolveSwaggerConfig(
  configService: ConfigService,
): SwaggerRuntimeConfig {
  const environment =
    getStringConfig(configService, ['NODE_ENV', 'app.env'], 'development') ??
    'development';

  const isProductionLikeEnvironment =
    environment === 'production' || environment === 'staging';

  const enabledDefault = !isProductionLikeEnvironment;

  const enabled = getBooleanConfig(
    configService,
    ['SWAGGER_ENABLED', 'swagger.enabled'],
    enabledDefault,
  );

  const path = normalizePath(
    getStringConfig(
      configService,
      ['SWAGGER_PATH', 'swagger.path'],
      SWAGGER_DEFAULT_PATH,
    ),
    SWAGGER_DEFAULT_PATH,
  );

  const jsonPath = normalizePath(
    getStringConfig(
      configService,
      ['SWAGGER_JSON_PATH', 'swagger.jsonPath'],
      SWAGGER_DEFAULT_JSON_PATH,
    ),
    SWAGGER_DEFAULT_JSON_PATH,
  );

  const yamlPath = normalizePath(
    getStringConfig(
      configService,
      ['SWAGGER_YAML_PATH', 'swagger.yamlPath'],
      SWAGGER_DEFAULT_YAML_PATH,
    ),
    SWAGGER_DEFAULT_YAML_PATH,
  );

  const version = getStringConfig(
    configService,
    ['APP_VERSION', 'app.version'],
    '1.0.0',
  );

  const title = getStringConfig(
    configService,
    ['SWAGGER_TITLE', 'swagger.title'],
    'VEXO Beauty Backend API',
  );

  const description = getStringConfig(
    configService,
    ['SWAGGER_DESCRIPTION', 'swagger.description'],
    [
      'مستندات رسمی API فروشگاه هوشمند VEXO Beauty.',
      'این مستندات شامل مسیرهای عمومی، مسیرهای مدیریتی، احراز هویت، محصولات، سفارش‌ها، پرداخت‌ها، انبار، رسانه، جستجو، هوش مصنوعی و گزارش‌ها است.',
    ].join(' '),
  );

  const serverUrl = normalizeServerUrl(
    getStringConfig(
      configService,
      ['SWAGGER_SERVER_URL', 'swagger.serverUrl'],
      resolveDefaultServerUrl(configService),
    ),
  );

  const bearerAuthName = getStringConfig(
    configService,
    ['SWAGGER_BEARER_AUTH_NAME', 'swagger.bearerAuthName'],
    SWAGGER_AUTH_NAME,
  );

  const persistAuthorization = getBooleanConfig(
    configService,
    ['SWAGGER_PERSIST_AUTHORIZATION', 'swagger.persistAuthorization'],
    !isProductionLikeEnvironment,
  );

  const explorer = getBooleanConfig(
    configService,
    ['SWAGGER_EXPLORER', 'swagger.explorer'],
    true,
  );

  return {
    enabled,
    path,
    jsonPath,
    yamlPath,
    title,
    description,
    version,
    serverUrl,
    bearerAuthName,
    persistAuthorization,
    explorer,
  };
}

function resolveDefaultServerUrl(configService: ConfigService): string {
  const port = getNumberConfig(configService, ['PORT', 'app.port'], 4000, {
    min: 1,
    max: 65_535,
  });

  const host = getStringConfig(
    configService,
    ['APP_PUBLIC_HOST', 'app.publicHost'],
    '127.0.0.1',
  );

  const protocol = getStringConfig(
    configService,
    ['APP_PROTOCOL', 'app.protocol'],
    'http',
  );

  return `${protocol}://${host}:${port}`;
}

function normalizePath(value: string, fallback = SWAGGER_DEFAULT_PATH): string {
  const normalizedPath = value.trim().replace(/^\/+/u, '').replace(/\/+$/u, '');

  return normalizedPath.length > 0 ? normalizedPath : fallback;
}

function normalizeServerUrl(value: string): string {
  const normalizedValue = value.trim().replace(/\/+$/u, '');

  return normalizedValue.length > 0 ? normalizedValue : 'http://127.0.0.1:4000';
}

function getStringConfig(
  configService: ConfigService,
  keys: readonly string[],
  defaultValue: string,
): string {
  for (const key of keys) {
    const value = configService.get<ConfigPrimitive>(key);

    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      if (normalizedValue.length > 0) {
        return normalizedValue;
      }
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
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
    const value = configService.get<ConfigPrimitive>(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
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

function getNumberConfig(
  configService: ConfigService,
  keys: readonly string[],
  defaultValue: number,
  options?: {
    readonly min?: number;
    readonly max?: number;
  },
): number {
  for (const key of keys) {
    const value = configService.get<ConfigPrimitive>(key);
    const parsedValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(parsedValue)) {
      continue;
    }

    if (options?.min !== undefined && parsedValue < options.min) {
      continue;
    }

    if (options?.max !== undefined && parsedValue > options.max) {
      continue;
    }

    return Math.floor(parsedValue);
  }

  return defaultValue;
}
