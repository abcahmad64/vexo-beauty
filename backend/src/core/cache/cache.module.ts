import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { CacheInvalidationHandler } from './cache-invalidation.handler';
import { CacheInvalidationPublisher } from './cache-invalidation.publisher';
import { CacheInvalidatorService } from './cache-invalidator.service';
import { CacheMethodInterceptor } from './cache.interceptor';
import { CacheService } from './cache.service';
import { RedisManagerService } from './redis-manager.service';

@Global()
@Module({
  providers: [
    RedisManagerService,
    CacheService,
    CacheInvalidatorService,
    CacheInvalidationPublisher,
    CacheInvalidationHandler,
    CacheMethodInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: CacheMethodInterceptor,
    },
  ],
  exports: [
    RedisManagerService,
    CacheService,
    CacheInvalidatorService,
    CacheInvalidationPublisher,
  ],
})
export class CoreCacheModule {}
