import { Global, Module } from '@nestjs/common';

import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { SecurityContextService } from './services/security-context.service';

@Global()
@Module({
  providers: [SecurityContextService, SecurityHeadersMiddleware],
  exports: [SecurityContextService, SecurityHeadersMiddleware],
})
export class SecurityModule {}
