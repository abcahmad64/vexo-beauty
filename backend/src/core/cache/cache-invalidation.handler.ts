import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

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
import { CacheInvalidatorService } from './cache-invalidator.service';
import type { CacheInvalidationOptions } from './interfaces/cache-invalidation.interface';

@Injectable()
export class CacheInvalidationHandler {
  private readonly logger = new Logger(CacheInvalidationHandler.name);

  constructor(
    private readonly cacheInvalidatorService: CacheInvalidatorService,
  ) {}

  @OnEvent(CacheInvalidationEventType.INVALIDATE_KEY)
  async handleInvalidateKey(payload: CacheInvalidateKeyPayload): Promise<void> {
    await this.safeInvalidate(
      {
        key: payload.key,
        actorId: this.normalizeActorId(payload.actorId),
      },
      'کلید کش حذف شد.',
    );
  }

  @OnEvent(CacheInvalidationEventType.INVALIDATE_KEYS)
  async handleInvalidateKeys(
    payload: CacheInvalidateKeysPayload,
  ): Promise<void> {
    await this.safeInvalidate(
      {
        keys: payload.keys,
        actorId: this.normalizeActorId(payload.actorId),
      },
      `چند کلید کش حذف شد: ${payload.keys.length}`,
    );
  }

  @OnEvent(CacheInvalidationEventType.INVALIDATE_PATTERN)
  async handleInvalidatePattern(
    payload: CacheInvalidatePatternPayload,
  ): Promise<void> {
    await this.safeInvalidate(
      {
        pattern: payload.pattern,
        actorId: this.normalizeActorId(payload.actorId),
      },
      'الگوی کش حذف شد.',
    );
  }

  @OnEvent(CacheInvalidationEventType.INVALIDATE_NAMESPACE)
  async handleInvalidateNamespace(
    payload: CacheInvalidateNamespacePayload,
  ): Promise<void> {
    await this.safeInvalidate(
      {
        namespace: payload.namespace,
        actorId: this.normalizeActorId(payload.actorId),
      },
      'Namespace کش حذف شد.',
    );
  }

  @OnEvent(CacheInvalidationEventType.INVALIDATE_TAG)
  async handleInvalidateTag(payload: CacheInvalidateTagPayload): Promise<void> {
    await this.safeInvalidate(
      {
        tag: payload.tag,
        actorId: this.normalizeActorId(payload.actorId),
      },
      'Tag کش حذف شد.',
    );
  }

  @OnEvent(CacheInvalidationEventType.INVALIDATE_TAGS)
  async handleInvalidateTags(
    payload: CacheInvalidateTagsPayload,
  ): Promise<void> {
    await this.safeInvalidate(
      {
        tags: payload.tags,
        actorId: this.normalizeActorId(payload.actorId),
      },
      `چند Tag کش حذف شد: ${payload.tags.length}`,
    );
  }

  @OnEvent(CacheInvalidationEventType.FLUSH_ALL)
  async handleFlushAll(payload: CacheFlushAllPayload): Promise<void> {
    await this.safeInvalidate(
      {
        flush: true,
        actorId: this.normalizeActorId(payload.actorId),
      },
      'تمام داده‌های کش حذف شدند.',
      'warn',
    );
  }

  private async safeInvalidate(
    options: CacheInvalidationOptions,
    successMessage: string,
    successLevel: 'debug' | 'warn' = 'debug',
  ): Promise<void> {
    try {
      const result = await this.cacheInvalidatorService.invalidate(options);

      if (!result.invalidated) {
        this.logger.debug(
          'درخواستی برای حذف کش دریافت شد، اما عملیاتی انجام نشد.',
        );
        return;
      }

      if (successLevel === 'warn') {
        this.logger.warn(successMessage);
        return;
      }

      this.logger.debug(successMessage);
    } catch (error) {
      this.logger.warn(`حذف کش ناموفق بود: ${this.extractErrorMessage(error)}`);
    }
  }

  private normalizeActorId(
    actorId: string | null | undefined,
  ): string | undefined {
    if (typeof actorId !== 'string') {
      return undefined;
    }

    const normalizedActorId = actorId.trim();

    return normalizedActorId.length > 0 ? normalizedActorId : undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'خطای نامشخص';
  }
}
