import { Global, Module } from '@nestjs/common';

import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { AuditLoggerService } from './services/audit-logger.service';
import { SecurityLoggerService } from './services/security-logger.service';
import { StructuredLoggerService } from './services/structured-logger.service';

@Global()
@Module({
  providers: [
    StructuredLoggerService,
    RequestLoggerMiddleware,
    AuditLoggerService,
    SecurityLoggerService,
  ],
  exports: [
    StructuredLoggerService,
    RequestLoggerMiddleware,
    AuditLoggerService,
    SecurityLoggerService,
  ],
})
export class LoggingModule {}
