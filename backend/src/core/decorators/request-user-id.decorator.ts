import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const RequestUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    if (context.getType() !== 'http') {
      return undefined;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return (
      normalizeUserId(request.user?.id) ??
      normalizeUserId(request.user?.userId) ??
      normalizeUserId(request.user?.sub)
    );
  },
);

function normalizeUserId(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}
