import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { LoggingModule } from '../logging/logging.module';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitConfigService } from './services/rate-limit-config.service';
import { RateLimitKeyService } from './services/rate-limit-key.service';
import { RateLimitStorageService } from './services/rate-limit-storage.service';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    RateLimitConfigService,
    RateLimitKeyService,
    RateLimitStorageService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [
    RateLimitConfigService,
    RateLimitKeyService,
    RateLimitStorageService,
  ],
})
export class RateLimitModule {}
