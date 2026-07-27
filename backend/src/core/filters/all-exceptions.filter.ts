import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { DEFAULT_API_MESSAGES } from '../constants/core.constants';
import { RequestContextService } from '../context/request-context.service';
import { mapPrismaError } from '../prisma/prisma-error.mapper';
import { formatPersianDateTime } from '../utils/persian-date.util';
import { safeJson } from '../utils/safe-json.util';

interface NormalizedException {
  readonly statusCode: number;
  readonly message: string;
  readonly error: string;
  readonly code?: string;
  readonly details?: unknown;
  readonly stack?: string;
}

interface HttpExceptionResponseShape {
  readonly message?: unknown;
  readonly error?: unknown;
  readonly statusCode?: unknown;
  readonly code?: unknown;
  readonly details?: unknown;
}

interface RequestWithId extends Request {
  readonly requestId?: string;
  readonly correlationId?: string;
}

interface ErrorPayloadError {
  readonly statusCode: number;
  readonly name: string;
  readonly code?: string;
  readonly details?: unknown;
}

interface ErrorPayloadMeta {
  readonly path: string;
  readonly method: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly durationMs?: number;
  readonly timestamp: string;
  readonly timestampFa: string;
}

interface ErrorResponsePayload {
  readonly success: false;
  readonly message: string;
  readonly data: null;
  readonly error: ErrorPayloadError;
  readonly meta: ErrorPayloadMeta;
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const normalized = this.normalizeException(exception);

    this.logException(request, normalized);

    if (response.headersSent) {
      return;
    }

    const payload = this.createPayload(request, normalized, new Date());

    response
      .status(normalized.statusCode)
      .json(this.isProduction() ? this.hideSensitivePayload(payload) : payload);
  }

  private createPayload(
    request: RequestWithId,
    normalized: NormalizedException,
    now: Date,
  ): ErrorResponsePayload {
    return {
      success: false,
      message: normalized.message,
      data: null,
      error: this.createErrorObject(normalized),
      meta: this.createMetaObject(request, now),
    };
  }

  private createErrorObject(
    normalized: NormalizedException,
  ): ErrorPayloadError {
    const error: {
      statusCode: number;
      name: string;
      code?: string;
      details?: unknown;
    } = {
      statusCode: normalized.statusCode,
      name: normalized.error,
    };

    if (normalized.code) {
      error.code = normalized.code;
    }

    if (normalized.details !== undefined) {
      error.details = normalized.details;
    }

    return error;
  }

  private createMetaObject(
    request: RequestWithId,
    now: Date,
  ): ErrorPayloadMeta {
    const meta: {
      path: string;
      method: string;
      requestId?: string;
      correlationId?: string;
      durationMs?: number;
      timestamp: string;
      timestampFa: string;
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
      this.extractHeader(request.headers['x-request-id']) ??
      this.normalizeString(request.correlationId) ??
      this.normalizeString(this.requestContextService.getCorrelationId()) ??
      this.extractHeader(request.headers['x-correlation-id'])
    );
  }

  private resolveCorrelationId(request: RequestWithId): string | undefined {
    return (
      this.normalizeString(request.correlationId) ??
      this.normalizeString(this.requestContextService.getCorrelationId()) ??
      this.extractHeader(request.headers['x-correlation-id'])
    );
  }

  private normalizeException(exception: unknown): NormalizedException {
    const prismaError = mapPrismaError(exception);

    if (prismaError) {
      return {
        statusCode: this.normalizeStatusCode(prismaError.statusCode),
        message:
          this.normalizeString(prismaError.message) ??
          DEFAULT_API_MESSAGES.INTERNAL_ERROR,
        error:
          this.normalizeHttpErrorName(prismaError.error) ??
          this.getHttpErrorName(prismaError.statusCode),
        code: this.normalizeCode(prismaError.code),
        details: this.normalizeDetails(prismaError.details),
        stack: exception instanceof Error ? exception.stack : undefined,
      };
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.isProduction()
          ? DEFAULT_API_MESSAGES.INTERNAL_ERROR
          : (this.normalizeString(exception.message) ??
            DEFAULT_API_MESSAGES.INTERNAL_ERROR),
        error: 'Internal Server Error',
        stack: exception.stack,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: DEFAULT_API_MESSAGES.INTERNAL_ERROR,
      error: 'Internal Server Error',
      details: this.isProduction()
        ? undefined
        : this.normalizeDetails(exception),
    };
  }

  private normalizeHttpException(
    exception: HttpException,
  ): NormalizedException {
    const statusCode = this.normalizeStatusCode(exception.getStatus());
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
        message:
          this.normalizeString(exceptionResponse) ??
          this.defaultMessageByStatus(statusCode),
        error: this.getHttpErrorName(statusCode),
        stack: exception.stack,
      };
    }

    if (!this.isRecord(exceptionResponse)) {
      return {
        statusCode,
        message: this.defaultMessageByStatus(statusCode),
        error: this.getHttpErrorName(statusCode),
        stack: exception.stack,
      };
    }

    const responseShape = exceptionResponse as HttpExceptionResponseShape;

    return {
      statusCode,
      message: this.normalizeMessage(responseShape.message, statusCode),
      error: this.normalizeErrorName(responseShape.error, statusCode),
      code: this.normalizeCode(responseShape.code),
      details: this.normalizeHttpDetails(
        responseShape.message,
        responseShape.details,
      ),
      stack: exception.stack,
    };
  }

  private normalizeMessage(message: unknown, statusCode: number): string {
    if (Array.isArray(message)) {
      return message.length > 0
        ? DEFAULT_API_MESSAGES.BAD_REQUEST
        : this.defaultMessageByStatus(statusCode);
    }

    return (
      this.normalizeString(message) ?? this.defaultMessageByStatus(statusCode)
    );
  }

  private normalizeHttpDetails(message: unknown, details?: unknown): unknown {
    if (details !== undefined) {
      return this.normalizeDetails(details);
    }

    if (Array.isArray(message)) {
      const validationErrors = message
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);

      return validationErrors.length > 0
        ? {
            validationErrors,
          }
        : undefined;
    }

    return undefined;
  }

  private normalizeDetails(details: unknown): unknown {
    if (details === undefined) {
      return undefined;
    }

    if (
      details === null ||
      typeof details === 'string' ||
      typeof details === 'number' ||
      typeof details === 'boolean'
    ) {
      return details;
    }

    return safeJson(details);
  }

  private normalizeErrorName(error: unknown, statusCode: number): string {
    return (
      this.normalizeHttpErrorName(error) ?? this.getHttpErrorName(statusCode)
    );
  }

  private normalizeHttpErrorName(error: unknown): string | undefined {
    const normalizedError = this.normalizeString(error);

    if (!normalizedError) {
      return undefined;
    }

    return normalizedError
      .split(/[_\s-]+/u)
      .filter((part) => part.length > 0)
      .map((part) => {
        const lowerPart = part.toLowerCase();

        return `${lowerPart.charAt(0).toUpperCase()}${lowerPart.slice(1)}`;
      })
      .join(' ');
  }

  private normalizeCode(code: unknown): string | undefined {
    return this.normalizeString(code);
  }

  private normalizeStatusCode(statusCode: number): number {
    if (
      Number.isInteger(statusCode) &&
      statusCode >= 400 &&
      statusCode <= 599
    ) {
      return statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private defaultMessageByStatus(statusCode: number): string {
    switch (statusCode) {
      case Number(HttpStatus.BAD_REQUEST):
        return DEFAULT_API_MESSAGES.BAD_REQUEST;

      case Number(HttpStatus.UNAUTHORIZED):
        return DEFAULT_API_MESSAGES.UNAUTHORIZED;

      case Number(HttpStatus.FORBIDDEN):
        return DEFAULT_API_MESSAGES.FORBIDDEN;

      case Number(HttpStatus.NOT_FOUND):
        return DEFAULT_API_MESSAGES.NOT_FOUND;

      case Number(HttpStatus.CONFLICT):
        return DEFAULT_API_MESSAGES.CONFLICT;

      case Number(HttpStatus.REQUEST_TIMEOUT):
        return DEFAULT_API_MESSAGES.REQUEST_TIMEOUT;

      case Number(HttpStatus.TOO_MANY_REQUESTS):
        return DEFAULT_API_MESSAGES.TOO_MANY_REQUESTS;

      case Number(HttpStatus.SERVICE_UNAVAILABLE):
        return DEFAULT_API_MESSAGES.SERVICE_UNAVAILABLE;

      default:
        return DEFAULT_API_MESSAGES.INTERNAL_ERROR;
    }
  }

  private getHttpErrorName(statusCode: number): string {
    const statusName = HttpStatus[statusCode];

    if (typeof statusName === 'string' && statusName.trim().length > 0) {
      return this.normalizeHttpErrorName(statusName) ?? 'Error';
    }

    return 'Error';
  }

  private extractHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).find((item) => item.length > 0);
    }

    return this.normalizeString(value);
  }

  private logException(
    request: Request,
    normalized: NormalizedException,
  ): void {
    const message =
      `${request.method} ${request.originalUrl || request.url || '/'} ` +
      `${normalized.statusCode} - ${normalized.message}`;

    if (normalized.statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(message, normalized.stack);
      return;
    }

    this.logger.warn(message);
  }

  private isProduction(): boolean {
    const env =
      this.configService.get<string>('app.env') ??
      this.configService.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development';

    return env.trim().toLowerCase() === 'production';
  }

  private hideSensitivePayload(
    payload: ErrorResponsePayload,
  ): ErrorResponsePayload {
    if (payload.error.statusCode < Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      return payload;
    }

    return {
      ...payload,
      message: DEFAULT_API_MESSAGES.INTERNAL_ERROR,
      error: {
        statusCode: payload.error.statusCode,
        name: 'Internal Server Error',
      },
    };
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
