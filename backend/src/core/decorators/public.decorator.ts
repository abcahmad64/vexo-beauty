import { SetMetadata } from '@nestjs/common';

import { CORE_METADATA_KEYS } from '../constants/core.constants';

export function Public(): MethodDecorator & ClassDecorator {
  return SetMetadata(CORE_METADATA_KEYS.IS_PUBLIC, true);
}
