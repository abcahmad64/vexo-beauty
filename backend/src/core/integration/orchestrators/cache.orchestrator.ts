import { Injectable } from '@nestjs/common';

import { CacheInvalidationPublisher } from '../../cache/cache-invalidation.publisher';
import { CACHE_NAMESPACE } from '../../cache/cache-ttl.constants';

@Injectable()
export class CacheOrchestrator {
  constructor(
    private readonly cacheInvalidationPublisher: CacheInvalidationPublisher,
  ) {}

  invalidateProductCache(actorId?: string | null): void {
    const occurredAt = new Date();
    const normalizedActorId = this.normalizeId(actorId);

    this.invalidateNamespaces(
      [
        CACHE_NAMESPACE.PRODUCT,
        CACHE_NAMESPACE.PRODUCT_LIST,
        CACHE_NAMESPACE.PRODUCT_DETAIL,
        CACHE_NAMESPACE.PRODUCT_RECOMMENDATION,
        CACHE_NAMESPACE.PRODUCT_SEO,
        CACHE_NAMESPACE.CATEGORY,
        CACHE_NAMESPACE.CATEGORY_TREE,
        CACHE_NAMESPACE.BRAND,
        CACHE_NAMESPACE.SEARCH,
        CACHE_NAMESPACE.SEMANTIC_SEARCH,
        CACHE_NAMESPACE.HOME,
        CACHE_NAMESPACE.AI_CONTENT,
        CACHE_NAMESPACE.AI_MARKETING,
        CACHE_NAMESPACE.AI_SALES,
        CACHE_NAMESPACE.AI_SEARCH,
        CACHE_NAMESPACE.ADMIN,
      ],
      normalizedActorId,
      occurredAt,
    );
  }

  invalidateOrderCache(userId?: string | null, actorId?: string | null): void {
    const occurredAt = new Date();
    const normalizedUserId = this.normalizeId(userId);
    const normalizedActorId = this.normalizeId(actorId);

    this.invalidateNamespaces(
      [
        CACHE_NAMESPACE.ORDER,
        CACHE_NAMESPACE.INVENTORY,
        CACHE_NAMESPACE.ANALYTICS,
        CACHE_NAMESPACE.ADMIN,
      ],
      normalizedActorId,
      occurredAt,
    );

    if (normalizedUserId) {
      this.invalidateKeys(
        [
          this.buildUserNotificationCountKey(normalizedUserId),
          this.buildUserOrderSummaryKey(normalizedUserId),
        ],
        normalizedActorId,
        occurredAt,
      );
    }
  }

  invalidatePaymentCache(
    userId?: string | null,
    actorId?: string | null,
  ): void {
    const occurredAt = new Date();
    const normalizedActorId = this.normalizeId(actorId);

    this.invalidateOrderCache(userId, normalizedActorId);

    this.invalidateNamespaces(
      [
        CACHE_NAMESPACE.PAYMENT,
        CACHE_NAMESPACE.ANALYTICS,
        CACHE_NAMESPACE.ADMIN,
      ],
      normalizedActorId,
      occurredAt,
    );
  }

  invalidateNotificationCache(userId: string, actorId?: string | null): void {
    const occurredAt = new Date();
    const normalizedUserId = this.normalizeId(userId);
    const normalizedActorId = this.normalizeId(actorId);

    if (normalizedUserId) {
      this.invalidateKeys(
        [this.buildUserNotificationCountKey(normalizedUserId)],
        normalizedActorId,
        occurredAt,
      );
    }

    this.invalidateNamespaces(
      [CACHE_NAMESPACE.NOTIFICATION],
      normalizedActorId,
      occurredAt,
    );
  }

  private invalidateNamespaces(
    namespaces: readonly string[],
    actorId: string | null,
    occurredAt: Date,
  ): void {
    for (const namespace of this.normalizeValues(namespaces)) {
      this.cacheInvalidationPublisher.invalidateNamespace({
        namespace,
        actorId,
        occurredAt,
      });
    }
  }

  private invalidateKeys(
    keys: readonly string[],
    actorId: string | null,
    occurredAt: Date,
  ): void {
    for (const key of this.normalizeValues(keys)) {
      this.cacheInvalidationPublisher.invalidateKey({
        key,
        actorId,
        occurredAt,
      });
    }
  }

  private buildUserNotificationCountKey(userId: string): string {
    return `${CACHE_NAMESPACE.NOTIFICATION}:unread-count:${userId}`;
  }

  private buildUserOrderSummaryKey(userId: string): string {
    return `${CACHE_NAMESPACE.ORDER}:summary:${userId}`;
  }

  private normalizeValues(values: readonly string[]): readonly string[] {
    return Array.from(
      new Set(
        values.map((value) => value.trim()).filter((value) => value.length > 0),
      ),
    );
  }

  private normalizeId(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }
}
