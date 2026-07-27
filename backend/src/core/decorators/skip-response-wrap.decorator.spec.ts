import 'reflect-metadata';

import { CORE_METADATA_KEYS } from '../constants/core.constants';

import { Public } from './public.decorator';
import { SkipResponseWrap } from './skip-response-wrap.decorator';

@Public()
class PublicTarget {}

@SkipResponseWrap()
class SkipResponseWrapTarget {}

describe('response metadata decorators', () => {
  it('keeps public and response-wrap metadata independent', () => {
    expect(
      Reflect.getMetadata(CORE_METADATA_KEYS.IS_PUBLIC, PublicTarget),
    ).toBe(true);
    expect(
      Reflect.getMetadata(CORE_METADATA_KEYS.SKIP_RESPONSE_WRAP, PublicTarget),
    ).toBeUndefined();

    expect(
      Reflect.getMetadata(
        CORE_METADATA_KEYS.SKIP_RESPONSE_WRAP,
        SkipResponseWrapTarget,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(CORE_METADATA_KEYS.IS_PUBLIC, SkipResponseWrapTarget),
    ).toBeUndefined();
  });
});
