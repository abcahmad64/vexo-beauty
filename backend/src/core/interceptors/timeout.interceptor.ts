import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';
import type { Observable } from 'rxjs';

import {
  DEFAULT_API_MESSAGES,
  DEFAULT_TIMEOUTS,
} from '../constants/core.constants';
import { ErrorCode } from '../errors/error-code.enum';

type HttpRequestWithUrl = {
  readonly method?: string;
  readonly originalUrl?: string;
  readonly url?: string;
  readonly path?: string;
};

interface TimeoutDetails {
  readonly timeoutMs: number;
  readonly method?: string;
  readonly path?: string;
}

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = this.getHttpRequest(context);
    const requestPath = this.resolveRequestPath(request);
    const timeoutMs = this.resolveTimeoutMs(requestPath);

    return next.handle().pipe(
      timeout({
        first: timeoutMs,
      }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException({
                message: DEFAULT_API_MESSAGES.REQUEST_TIMEOUT,
                code: ErrorCode.REQUEST_TIMEOUT,
                details: this.createTimeoutDetails(request, timeoutMs),
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private resolveTimeoutMs(requestPath: string): number {
    if (this.isAiRequest(requestPath)) {
      return this.readNumber(
        [
          'AI_REQUEST_TIMEOUT_MS',
          'ai.requestTimeoutMs',
          'AI_OLLAMA_TIMEOUT_MS',
          'OLLAMA_TIMEOUT_MS',
          'ai.ollama.timeoutMs',
        ],
        240_000,
        {
          min: 30_000,
          max: 900_000,
        },
      );
    }

    if (this.isLongRunningHttpRequest(requestPath)) {
      return this.readNumber(
        [
          'LONG_REQUEST_TIMEOUT_MS',
          'UPLOAD_REQUEST_TIMEOUT_MS',
          'MEDIA_REQUEST_TIMEOUT_MS',
          'app.longRequestTimeoutMs',
          'media.requestTimeoutMs',
        ],
        300_000,
        {
          min: 30_000,
          max: 900_000,
        },
      );
    }

    return this.readNumber(
      [
        'REQUEST_TIMEOUT_MS',
        'app.requestTimeoutMs',
        'security.requestTimeoutMs',
      ],
      DEFAULT_TIMEOUTS.HTTP_REQUEST_MS,
      {
        min: 1_000,
        max: 300_000,
      },
    );
  }

  private getHttpRequest(context: ExecutionContext): HttpRequestWithUrl | null {
    if (context.getType() !== 'http') {
      return null;
    }

    return context.switchToHttp().getRequest<HttpRequestWithUrl>();
  }

  private resolveRequestPath(request: HttpRequestWithUrl | null): string {
    return this.normalizePath(
      request?.originalUrl ?? request?.url ?? request?.path ?? '',
    );
  }

  private createTimeoutDetails(
    request: HttpRequestWithUrl | null,
    timeoutMs: number,
  ): TimeoutDetails {
    const details: {
      timeoutMs: number;
      method?: string;
      path?: string;
    } = {
      timeoutMs,
    };

    const method = this.normalizeString(request?.method);
    const path = this.resolveRequestPath(request);

    if (method) {
      details.method = method;
    }

    if (path) {
      details.path = path;
    }

    return details;
  }

  private isAiRequest(requestPath: string): boolean {
    const normalizedPath = this.normalizePath(requestPath).toLowerCase();

    if (
      normalizedPath.startsWith('/api/ai') ||
      normalizedPath.startsWith('/api/admin/ai') ||
      normalizedPath.startsWith('/ai') ||
      normalizedPath.startsWith('/admin/ai')
    ) {
      return true;
    }

    const segments = normalizedPath.split('/').filter(Boolean);

    return segments.includes('ai');
  }

  private isLongRunningHttpRequest(requestPath: string): boolean {
    const normalizedPath = this.normalizePath(requestPath).toLowerCase();

    if (
      normalizedPath.startsWith('/api/upload') ||
      normalizedPath.startsWith('/api/uploads') ||
      normalizedPath.startsWith('/api/media') ||
      normalizedPath.startsWith('/api/admin/import') ||
      normalizedPath.startsWith('/upload') ||
      normalizedPath.startsWith('/uploads') ||
      normalizedPath.startsWith('/media') ||
      normalizedPath.startsWith('/admin/import')
    ) {
      return true;
    }

    const segments = normalizedPath.split('/').filter(Boolean);

    return (
      segments.includes('upload') ||
      segments.includes('uploads') ||
      segments.includes('media') ||
      segments.includes('import')
    );
  }

  private normalizePath(value: string): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return '';
    }

    const withoutQuery = normalizedValue.split('?')[0] ?? normalizedValue;

    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  }

  private readNumber(
    keys: readonly string[],
    fallback: number,
    limits: {
      readonly min: number;
      readonly max: number;
    },
  ): number {
    for (const key of keys) {
      const parsedFromConfig = this.parseNumber(
        this.configService.get<unknown>(key),
        limits,
      );

      if (parsedFromConfig !== null) {
        return parsedFromConfig;
      }

      const parsedFromEnv = this.parseNumber(process.env[key], limits);

      if (parsedFromEnv !== null) {
        return parsedFromEnv;
      }
    }

    return this.parseNumber(fallback, limits) ?? limits.min;
  }

  private parseNumber(
    value: unknown,
    limits: {
      readonly min: number;
      readonly max: number;
    },
  ): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    let parsed: number;

    if (typeof value === 'number') {
      parsed = value;
    } else if (typeof value === 'string') {
      parsed = Number(value.trim());
    } else {
      return null;
    }

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Math.min(limits.max, Math.max(limits.min, Math.trunc(parsed)));
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
