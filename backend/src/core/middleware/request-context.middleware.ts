import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { REQUEST_HEADERS } from '../constants/core.constants';
import { RequestContextService } from '../context/request-context.service';

const MAX_CONTEXT_ID_LENGTH = 128;

const SAFE_CONTEXT_ID_PATTERN = /^[a-zA-Z0-9._:/@-]+$/u;

interface RequestWithContext extends Request {
  requestId?: string;
  correlationId?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId =
      this.extractSafeHeader(request.headers[REQUEST_HEADERS.REQUEST_ID]) ??
      randomUUID();

    const correlationId =
      this.extractSafeHeader(request.headers[REQUEST_HEADERS.CORRELATION_ID]) ??
      requestId;

    request.requestId = requestId;
    request.correlationId = correlationId;

    response.setHeader(REQUEST_HEADERS.REQUEST_ID, requestId);
    response.setHeader(REQUEST_HEADERS.CORRELATION_ID, correlationId);

    this.requestContextService.run(
      {
        requestId,
        correlationId,
        startedAt: Date.now(),
      },
      next,
    );
  }

  private extractSafeHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    const normalizedValue = this.extractHeader(value);

    if (!normalizedValue) {
      return undefined;
    }

    if (normalizedValue.length > MAX_CONTEXT_ID_LENGTH) {
      return undefined;
    }

    if (!SAFE_CONTEXT_ID_PATTERN.test(normalizedValue)) {
      return undefined;
    }

    return normalizedValue;
  }

  private extractHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).find((item) => item.length > 0);
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
