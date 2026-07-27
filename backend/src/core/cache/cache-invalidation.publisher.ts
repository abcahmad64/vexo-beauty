import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  CacheFlushAllPayload,
  CacheInvalidateKeyPayload,
  CacheInvalidateKeysPayload,
  CacheInvalidateNamespacePayload,
  CacheInvalidatePatternPayload,
  CacheInvalidateTagPayload,
  CacheInvalidateTagsPayload,
  CacheInvalidationEventType,
} from './cache-invalidation.event';

@Injectable()
export class CacheInvalidationPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  invalidateKey(payload: CacheInvalidateKeyPayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_KEY, payload);
  }

  invalidateKeys(payload: CacheInvalidateKeysPayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_KEYS, payload);
  }

  invalidatePattern(payload: CacheInvalidatePatternPayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_PATTERN, payload);
  }

  invalidateNamespace(payload: CacheInvalidateNamespacePayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_NAMESPACE, payload);
  }

  invalidateTag(payload: CacheInvalidateTagPayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_TAG, payload);
  }

  invalidateTags(payload: CacheInvalidateTagsPayload): void {
    this.emit(CacheInvalidationEventType.INVALIDATE_TAGS, payload);
  }

  flushAll(payload: CacheFlushAllPayload): void {
    this.emit(CacheInvalidationEventType.FLUSH_ALL, payload);
  }

  private emit<TPayload>(
    eventType: CacheInvalidationEventType,
    payload: TPayload,
  ): void {
    this.eventEmitter.emit(eventType, payload);
  }
}
