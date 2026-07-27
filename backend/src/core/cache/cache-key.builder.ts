import { createHash } from 'node:crypto';

import type { CacheKeyPart } from './interfaces/cache-options.interface';

export class CacheKeyBuilder {
  static build(namespace: string, ...parts: readonly CacheKeyPart[]): string {
    return [
      this.normalizePart(namespace),
      ...parts
        .filter((part) => part !== undefined && part !== null)
        .map((part) => this.normalizePart(part)),
    ].join(':');
  }

  static hash(value: unknown): string {
    const normalizedValue = this.normalizeForHash(value);

    const serialized = JSON.stringify(normalizedValue) ?? '';

    return createHash('sha256').update(serialized).digest('hex').slice(0, 32);
  }

  static productList(queryHash: string): string {
    return this.build('product:list', queryHash);
  }

  static productDetail(productId: string): string {
    return this.build('product:detail', productId);
  }

  static productVariants(productId: string): string {
    return this.build('product:variants', productId);
  }

  static productAttributes(productId: string): string {
    return this.build('product:attributes', productId);
  }

  static search(queryHash: string): string {
    return this.build('search', queryHash);
  }

  static searchSuggestions(query: string): string {
    return this.build(
      'search:suggestions',
      this.hash({
        query,
      }),
    );
  }

  static categoryTree(): string {
    return this.build('category:tree');
  }

  static categoryDetail(categoryId: string): string {
    return this.build('category:detail', categoryId);
  }

  static brandList(): string {
    return this.build('brand:list');
  }

  static brandDetail(brandId: string): string {
    return this.build('brand:detail', brandId);
  }

  static cart(userId: string): string {
    return this.build('cart', userId);
  }

  static wishlist(userId: string): string {
    return this.build('wishlist', userId);
  }

  static couponValidation(code: string, userId?: string): string {
    return this.build('coupon:validation', code, userId);
  }

  static analyticsDashboard(queryHash: string): string {
    return this.build('analytics:dashboard', queryHash);
  }

  static adminDashboard(): string {
    return this.build('admin:dashboard');
  }

  static notificationUnreadCount(userId: string): string {
    return this.build('notification:unread-count', userId);
  }

  static aiConversation(conversationId: string): string {
    return this.build('ai:conversation', conversationId);
  }

  static fromQuery(namespace: string, query: unknown): string {
    return this.build(namespace, this.hash(query));
  }

  private static normalizePart(part: CacheKeyPart): string {
    if (part instanceof Date) {
      return part.toISOString();
    }

    return String(part)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9آ-ی:_-]/giu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private static normalizeForHash(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForHash(item));
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;

      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.normalizeForHash(record[key]);

          return result;
        }, {});
    }

    return value;
  }
}
