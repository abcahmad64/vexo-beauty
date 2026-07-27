import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { REQUEST_HEADERS } from '../constants/core.constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    if (context.getType() !== 'http') {
      return undefined;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return (
      normalizeValue(request.requestId) ??
      normalizeValue(request.headers[REQUEST_HEADERS.REQUEST_ID]) ??
      normalizeValue(request.correlationId) ??
      normalizeValue(request.headers[REQUEST_HEADERS.CORRELATION_ID])
    );
  },
);

function normalizeValue(
  value: string | string[] | number | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).find((item) => item.length > 0);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}
