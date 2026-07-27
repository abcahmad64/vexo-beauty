import { SetMetadata, applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  RATE_LIMIT_METADATA,
  RATE_LIMIT_PROFILE_DEFAULTS,
} from '../constants/rate-limit.constants';
import type {
  RateLimitCustomOptions,
  RateLimitProfile,
} from '../types/rate-limit.types';

export function RateLimit(
  profileOrOptions: RateLimitProfile | RateLimitCustomOptions = 'default',
): ClassDecorator & MethodDecorator {
  const options =
    typeof profileOrOptions === 'string'
      ? {
          profile: profileOrOptions,
        }
      : profileOrOptions;

  const profile = options.profile ?? 'default';
  const defaults =
    RATE_LIMIT_PROFILE_DEFAULTS[profile] ?? RATE_LIMIT_PROFILE_DEFAULTS.default;

  const limit = normalizePositiveInteger(options.limit, defaults.limit);
  const ttlMs = normalizePositiveInteger(options.ttlMs, defaults.ttlMs);
  const blockMs = normalizePositiveInteger(options.blockMs, defaults.blockMs);
  const message = normalizeOptionalString(options.message) ?? defaults.message;

  return applyDecorators(
    SetMetadata(RATE_LIMIT_METADATA.PROFILE, profile),
    SetMetadata(RATE_LIMIT_METADATA.OPTIONS, {
      ...options,
      profile,
      limit,
      ttlMs,
      blockMs,
      message,
    }),
    Throttle({
      default: {
        limit,
        ttl: ttlMs,
      },
    }),
  );
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}
