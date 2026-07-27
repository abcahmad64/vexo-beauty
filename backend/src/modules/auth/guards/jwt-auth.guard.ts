import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { CORE_METADATA_KEYS } from '../../../core/constants/core.constants';
import { SECURITY_MESSAGES } from '../../../core/security/constants/security.constants';

type GuardActivationResult = boolean | Promise<boolean> | Observable<boolean>;

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): GuardActivationResult {
    if (this.isPublicRoute(context)) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(
    error: Error | null,
    user: TUser | false | null | undefined,
  ): TUser {
    if (error) {
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException(SECURITY_MESSAGES.AUTH_REQUIRED);
    }

    return user;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(CORE_METADATA_KEYS.IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
