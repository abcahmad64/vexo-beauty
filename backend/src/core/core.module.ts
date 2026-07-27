import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { CoreCacheModule } from './cache/cache.module';
import { RequestContextService } from './context/request-context.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { IntegrationModule } from './integration/integration.module';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { LoggingModule } from './logging/logging.module';
import { RequestLoggerMiddleware } from './logging/middleware/request-logger.middleware';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { CoreQueueModule } from './queue/queue.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CoreSchedulerModule } from './scheduler/scheduler.module';
import { SecurityHeadersMiddleware } from './security/middleware/security-headers.middleware';
import { SecurityModule } from './security/security.module';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 50,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    PrismaModule,
    CoreCacheModule,
    LoggingModule,
    SecurityModule,
    RateLimitModule,
    CoreQueueModule,
    CoreSchedulerModule,
    IntegrationModule,
  ],
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
  exports: [
    PrismaModule,
    CoreCacheModule,
    LoggingModule,
    SecurityModule,
    RateLimitModule,
    CoreQueueModule,
    CoreSchedulerModule,
    RequestContextService,
    IntegrationModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestContextMiddleware,
        SecurityHeadersMiddleware,
        RequestLoggerMiddleware,
      )
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}
