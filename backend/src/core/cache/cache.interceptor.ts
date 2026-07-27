import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import {
  CACHE_INVALIDATE_METADATA,
  CACHE_KEY_METADATA,
  CACHE_TAGS_METADATA,
  CACHE_TTL_METADATA,
} from './cache-metadata.constants';
import { CacheInvalidatorService } from './cache-invalidator.service';
import { CacheService } from './cache.service';
import { CACHE_TTL } from './cache-ttl.constants';
import type {
  CacheKeyFactory,
  CacheKeyMetadata,
} from './decorators/cache-key.decorator';
import type { CacheTagsMetadata } from './decorators/cache-tags.decorator';
import type { CacheInvalidationOptions } from './interfaces/cache-invalidation.interface';

interface CacheHttpRequest {
  readonly method?: string;
  readonly originalUrl?: string;
  readonly url?: string;
  readonly user?: {
    readonly id?: string;
    readonly userId?: string;
    readonly sub?: string;
  };
}

interface CacheLookupResult {
  readonly hit: boolean;
  readonly key: string | null;
  readonly value: unknown;
  readonly ttlSeconds: number;
  readonly tags: readonly string[];
}

@Injectable()
export class CacheMethodInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly cacheInvalidatorService: CacheInvalidatorService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const cacheKeyMetadata = this.getCacheKeyMetadata(context);
    const invalidationMetadata = this.getInvalidationMetadata(context);

    if (!cacheKeyMetadata && !invalidationMetadata) {
      return next.handle();
    }

    if (cacheKeyMetadata && this.isCacheableHttpRequest(context)) {
      return from(this.resolveCachedValue(context, cacheKeyMetadata)).pipe(
        mergeMap((lookup) => {
          if (lookup.hit) {
            return of(lookup.value);
          }

          return next.handle().pipe(
            mergeMap(async (response: unknown) => {
              if (lookup.key && typeof response !== 'undefined') {
                await this.safeCacheSet(
                  lookup.key,
                  response,
                  lookup.ttlSeconds,
                  lookup.tags,
                );
              }

              if (invalidationMetadata) {
                await this.applyInvalidation(context, invalidationMetadata);
              }

              return response;
            }),
          );
        }),
      );
    }

    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        if (invalidationMetadata) {
          await this.applyInvalidation(context, invalidationMetadata);
        }

        return response;
      }),
    );
  }

  private async resolveCachedValue(
    context: ExecutionContext,
    metadata: CacheKeyMetadata,
  ): Promise<CacheLookupResult> {
    const key = this.normalizeCacheKey(this.resolveCacheKey(context, metadata));
    const ttlSeconds = this.resolveTtlSeconds(context);
    const tags = this.resolveTags(context);

    if (!key) {
      return {
        hit: false,
        key: null,
        value: null,
        ttlSeconds,
        tags,
      };
    }

    const cached = await this.safeCacheGet(key);

    return {
      hit: cached !== null,
      key,
      value: cached,
      ttlSeconds,
      tags,
    };
  }

  private getCacheKeyMetadata(
    context: ExecutionContext,
  ): CacheKeyMetadata | undefined {
    return this.reflector.getAllAndOverride<CacheKeyMetadata>(
      CACHE_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );
  }

  private getInvalidationMetadata(
    context: ExecutionContext,
  ): CacheInvalidationOptions | undefined {
    return this.reflector.getAllAndOverride<CacheInvalidationOptions>(
      CACHE_INVALIDATE_METADATA,
      [context.getHandler(), context.getClass()],
    );
  }

  private resolveCacheKey(
    context: ExecutionContext,
    metadata: CacheKeyMetadata,
  ): string {
    if (typeof metadata === 'string') {
      return metadata;
    }

    const factory: CacheKeyFactory = metadata;

    return factory(context);
  }

  private normalizeCacheKey(key: string): string | null {
    const normalizedKey = key.trim();

    return normalizedKey.length > 0 ? normalizedKey : null;
  }

  private resolveTtlSeconds(context: ExecutionContext): number {
    const metadata = this.reflector.getAllAndOverride<number>(
      CACHE_TTL_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (
      typeof metadata === 'number' &&
      Number.isFinite(metadata) &&
      metadata > 0
    ) {
      return Math.trunc(metadata);
    }

    return CACHE_TTL.MEDIUM;
  }

  private resolveTags(context: ExecutionContext): readonly string[] {
    const metadata = this.reflector.getAllAndOverride<CacheTagsMetadata>(
      CACHE_TAGS_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return [];
    }

    const tags = typeof metadata === 'function' ? metadata(context) : metadata;

    return this.normalizeTags(tags);
  }

  private normalizeTags(tags: readonly string[]): readonly string[] {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }

  private async applyInvalidation(
    context: ExecutionContext,
    options: CacheInvalidationOptions,
  ): Promise<void> {
    await this.cacheInvalidatorService.invalidate({
      ...options,
      actorId: options.actorId ?? this.resolveActorId(context),
    });
  }

  private async safeCacheGet(key: string): Promise<unknown> {
    try {
      return await this.cacheService.get<unknown>(key);
    } catch {
      return null;
    }
  }

  private async safeCacheSet(
    key: string,
    value: unknown,
    ttlSeconds: number,
    tags: readonly string[],
  ): Promise<void> {
    try {
      await this.cacheService.set(key, value, {
        ttlSeconds,
        tags,
      });
    } catch {
      // Cache failure must not break the main API response.
    }
  }

  private isCacheableHttpRequest(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }

    const request = context.switchToHttp().getRequest<CacheHttpRequest>();

    return request.method?.toUpperCase() === 'GET';
  }

  private resolveActorId(context: ExecutionContext): string | undefined {
    if (context.getType() !== 'http') {
      return undefined;
    }

    const request = context.switchToHttp().getRequest<CacheHttpRequest>();

    return request.user?.id ?? request.user?.userId ?? request.user?.sub;
  }
}
