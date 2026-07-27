import { SetMetadata } from '@nestjs/common';

import { CORE_METADATA_KEYS } from '../constants/core.constants';

export function SkipResponseWrap(): MethodDecorator & ClassDecorator {
  return SetMetadata(CORE_METADATA_KEYS.SKIP_RESPONSE_WRAP, true);
}
