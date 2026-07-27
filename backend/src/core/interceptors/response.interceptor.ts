import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';

import {
  CORE_METADATA_KEYS,
  DEFAULT_API_MESSAGES,
  REQUEST_HEADERS,
} from '../constants/core.constants';
import { RequestContextService } from '../context/request-context.service';
import { ApiResponseFactory } from '../response/api-response.factory';
import type {
  ApiResponse,
  ApiResponseMeta,
} from '../response/api-response.interface';
import { formatPersianDateTime } from '../utils/persian-date.util';

interface RequestWithId extends Request {
  readonly requestId?: string;
  readonly correlationId?: string;
}

@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<
  T,
  ApiResponse<T | null> | T
> {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T | null> | T> {
    if (context.getType() !== 'http' || this.shouldSkipResponseWrap(context)) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data: T): ApiResponse<T | null> | T => {
        if (data instanceof StreamableFile) {
          return data;
        }

        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        return ApiResponseFactory.success<T | null>(
          data ?? null,
          DEFAULT_API_MESSAGES.SUCCESS,
          this.createMeta(request, new Date()),
        );
      }),
    );
  }

  private createMeta(request: RequestWithId, now: Date): ApiResponseMeta {
    const meta: {
      path: string;
      method: string;
      requestId?: string;
      correlationId?: string;
      durationMs?: number;
      timestamp: string;
      timestampFa?: string | null;
    } = {
      path: request.originalUrl || request.url || '/',
      method: request.method,
      timestamp: now.toISOString(),
      timestampFa: formatPersianDateTime(now) ?? now.toISOString(),
    };

    const requestId = this.resolveRequestId(request);
    const correlationId = this.resolveCorrelationId(request);
    const durationMs = this.requestContextService.getDurationMs();

    if (requestId) {
      meta.requestId = requestId;
    }

    if (correlationId) {
      meta.correlationId = correlationId;
    }

    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
      meta.durationMs = Math.max(0, Math.trunc(durationMs));
    }

    return meta;
  }

  private resolveRequestId(request: RequestWithId): string | undefined {
    return (
      this.normalizeString(request.requestId) ??
      this.normalizeString(this.requestContextService.getRequestId()) ??
      this.extractHeader(request.headers[REQUEST_HEADERS.REQUEST_ID]) ??
      this.normalizeString(request.correlationId) ??
      this.normalizeString(this.requestContextService.getCorrelationId()) ??
      this.extractHeader(request.headers[REQUEST_HEADERS.CORRELATION_ID])
    );
  }

  private resolveCorrelationId(request: RequestWithId): string | undefined {
    return (
      this.normalizeString(request.correlationId) ??
      this.normalizeString(this.requestContextService.getCorrelationId()) ??
      this.extractHeader(request.headers[REQUEST_HEADERS.CORRELATION_ID])
    );
  }

  private shouldSkipResponseWrap(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(
        CORE_METADATA_KEYS.SKIP_RESPONSE_WRAP,
        [context.getHandler(), context.getClass()],
      ) === true
    );
  }

  private isAlreadyWrapped(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const record = data as Record<string, unknown>;

    return (
      typeof record.success === 'boolean' &&
      ('data' in record || 'message' in record || 'meta' in record)
    );
  }

  private extractHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).find((item) => item.length > 0);
    }

    return this.normalizeString(value);
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
