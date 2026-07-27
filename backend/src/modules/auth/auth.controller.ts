import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { SecurityContextService } from '../../core/security/services/security-context.service';

import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { AuthService } from './services/auth.service';

type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @RateLimit('auth')
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(dto, this.getRequestMeta(req));
  }

  @RateLimit('auth')
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: AuthenticatedRequest) {
    return this.authService.refresh(dto, this.getRequestMeta(req));
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.logout(
      user.id,
      dto,
      user.sessionId ?? null,
      this.getRequestMeta(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.logoutAll(user.id, this.getRequestMeta(req));
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/revoke')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.revokeSession(
      user.id,
      sessionId.trim(),
      this.getRequestMeta(req),
    );
  }

  private getRequestMeta(req: AuthenticatedRequest): RequestMeta {
    const client = this.securityContext.getClientInfoForRequest(req);

    return {
      ipAddress: client.ip,
      userAgent: client.userAgent,
    };
  }
}
