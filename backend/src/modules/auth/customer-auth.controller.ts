import { Body, Controller, Post, Req } from '@nestjs/common';

import type { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { SecurityContextService } from '../../core/security/services/security-context.service';

import { CustomerRequestOtpDto } from './dto/customer-request-otp.dto';
import { CustomerVerifyOtpDto } from './dto/customer-verify-otp.dto';
import { CustomerAuthService } from './services/customer-auth.service';

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

@Controller('auth/customer')
export class CustomerAuthController {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @RateLimit('auth')
  @Post('request-otp')
  requestOtp(
    @Body() dto: CustomerRequestOtpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customerAuthService.requestOtp(dto, this.getRequestMeta(req));
  }

  @RateLimit('auth')
  @Post('verify-otp')
  verifyOtp(
    @Body() dto: CustomerVerifyOtpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.customerAuthService.verifyOtp(dto, this.getRequestMeta(req));
  }

  private getRequestMeta(req: AuthenticatedRequest): RequestMeta {
    const client = this.securityContext.getClientInfoForRequest(req);

    return {
      ipAddress: client.ip,
      userAgent: client.userAgent,
    };
  }
}
