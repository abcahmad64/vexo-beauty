import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

import { REQUEST_HEADERS } from '../../constants/core.constants';
import { LOG_CONTEXT } from '../constants/logging.constants';
import type { RequestLogMetadata } from '../interfaces/logging.interfaces';
import { StructuredLoggerService } from '../services/structured-logger.service';

type ConfigPrimitive = string | number | boolean;

interface RequestWithContext extends Request {
  readonly requestId?: string;
  readonly correlationId?: string;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    if (!this.isEnabled()) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    const path = request.originalUrl || request.url || '/';

    if (this.shouldExcludeRequest(path)) {
      next();
      return;
    }

    response.once('finish', () => {
      const durationMs = this.calculateDurationMs(startedAt);

      const metadata: RequestLogMetadata = {
        requestId:
          this.normalizeString(request.requestId) ??
          this.getHeaderValue(request, REQUEST_HEADERS.REQUEST_ID),
        correlationId:
          this.normalizeString(request.correlationId) ??
          this.getHeaderValue(request, REQUEST_HEADERS.CORRELATION_ID),
        method: request.method,
        url: path,
        statusCode: response.statusCode,
        durationMs,
        ip: this.resolveIp(request),
        userAgent: this.getHeaderValue(request, 'user-agent'),
        contentLength: this.resolveContentLength(response),
      };

      this.logger.write({
        level: this.resolveLevelByStatusCode(response.statusCode),
        context: LOG_CONTEXT.REQUEST,
        message: 'درخواست HTTP پردازش شد.',
        metadata: metadata as unknown as Readonly<Record<string, unknown>>,
      });
    });

    next();
  }

  private calculateDurationMs(startedAt: bigint): number {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;

    return Math.round(durationMs * 100) / 100;
  }

  private isEnabled(): boolean {
    return this.getBooleanConfig(
      [
        'REQUEST_LOG_ENABLED',
        'logging.requestLog.enabled',
        'logging.request.enabled',
      ],
      true,
    );
  }

  private shouldExcludeRequest(path: string): boolean {
    const normalizedPath = this.normalizePath(path);

    if (this.shouldExcludeHealth() && this.isHealthPath(normalizedPath)) {
      return true;
    }

    const excludedPaths = this.getExcludedPaths();

    return excludedPaths.some((excludedPath) => {
      return (
        normalizedPath === excludedPath ||
        normalizedPath.startsWith(`${excludedPath}/`)
      );
    });
  }

  private shouldExcludeHealth(): boolean {
    return this.getBooleanConfig(
      [
        'REQUEST_LOG_EXCLUDE_HEALTH',
        'logging.requestLog.excludeHealth',
        'logging.request.excludeHealth',
      ],
      true,
    );
  }

  private isHealthPath(path: string): boolean {
    return (
      path === '/health' ||
      path.startsWith('/health/') ||
      path === '/api/health' ||
      path.startsWith('/api/health/')
    );
  }

  private getExcludedPaths(): readonly string[] {
    const rawValue = this.getFirstConfigValue([
      'REQUEST_LOG_EXCLUDED_PATHS',
      'logging.requestLog.excludedPaths',
      'logging.request.excludedPaths',
    ]);

    if (!rawValue) {
      return [];
    }

    return rawValue
      .split(',')
      .map((item) => this.normalizePath(item))
      .filter((item) => item !== '/');
  }

  private resolveLevelByStatusCode(
    statusCode: number,
  ): 'log' | 'warn' | 'error' {
    if (statusCode >= 500) {
      return 'error';
    }

    if (statusCode >= 400) {
      return 'warn';
    }

    return 'log';
  }

  private resolveIp(request: Request): string | null {
    if (this.shouldTrustProxy()) {
      const cfConnectingIp = this.getHeaderValue(request, 'cf-connecting-ip');

      if (cfConnectingIp) {
        return this.normalizeIp(cfConnectingIp);
      }

      const realIp = this.getHeaderValue(request, 'x-real-ip');

      if (realIp) {
        return this.normalizeIp(realIp);
      }

      const forwardedFor = this.getHeaderValue(request, 'x-forwarded-for');

      if (forwardedFor) {
        const firstForwardedIp = forwardedFor
          .split(',')
          .map((item) => item.trim())
          .find((item) => item.length > 0);

        if (firstForwardedIp) {
          return this.normalizeIp(firstForwardedIp);
        }
      }
    }

    return this.normalizeIp(request.ip ?? request.socket.remoteAddress ?? '');
  }

  private shouldTrustProxy(): boolean {
    return this.getBooleanConfig(
      [
        'RATE_LIMIT_TRUST_PROXY',
        'TRUST_PROXY',
        'security.trustProxy',
        'rateLimit.trustProxy',
      ],
      false,
    );
  }

  private resolveContentLength(response: Response): string | null {
    const value = response.getHeader('content-length');

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.join(',');
    }

    return null;
  }

  private getHeaderValue(request: Request, headerName: string): string | null {
    const value = request.headers[headerName.toLowerCase()];

    if (Array.isArray(value)) {
      return (
        value.map((item) => item.trim()).find((item) => item.length > 0) ?? null
      );
    }

    return this.normalizeString(value) ?? null;
  }

  private normalizePath(path: string): string {
    const withoutQuery = path.split('?')[0]?.trim() || '/';

    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  }

  private normalizeIp(value: string): string | null {
    const normalizedValue = value.trim().replace(/^::ffff:/u, '');

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private getFirstConfigValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);
      const normalizedValue = this.normalizeString(value);

      if (normalizedValue) {
        return normalizedValue;
      }

      const envValue = this.normalizeString(process.env[key]);

      if (envValue) {
        return envValue;
      }
    }

    return undefined;
  }

  private getBooleanConfig(
    keys: readonly string[],
    defaultValue: boolean,
  ): boolean {
    for (const key of keys) {
      const parsedFromConfig = this.parseBoolean(
        this.configService.get<ConfigPrimitive>(key),
      );

      if (parsedFromConfig !== null) {
        return parsedFromConfig;
      }

      const parsedFromEnv = this.parseBoolean(process.env[key]);

      if (parsedFromEnv !== null) {
        return parsedFromEnv;
      }
    }

    return defaultValue;
  }

  private parseBoolean(value: unknown): boolean | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value !== 'string' && typeof value !== 'bigint') {
      return null;
    }

    const normalizedValue =
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : value.toString().trim().toLowerCase();

    if (normalizedValue === '') {
      return null;
    }

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return null;
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }
}
