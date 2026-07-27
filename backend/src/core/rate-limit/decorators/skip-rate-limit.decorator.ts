import { SetMetadata, applyDecorators } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { RATE_LIMIT_METADATA } from '../constants/rate-limit.constants';

export function SkipRateLimit(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_METADATA.SKIP, true),
    SkipThrottle(),
  );
}
