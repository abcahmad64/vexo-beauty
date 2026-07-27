import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { isObservable, lastValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';

type GuardActivationResult = boolean | Promise<boolean> | Observable<boolean>;

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.hasBearerToken(request)) {
      return true;
    }

    try {
      await this.resolveActivationResult(super.canActivate(context));
    } catch {
      return true;
    }

    return true;
  }

  handleRequest<TUser = unknown>(
    _error: unknown,
    user: TUser | false | null | undefined,
  ): TUser | null {
    return user || null;
  }

  private hasBearerToken(request: Request): boolean {
    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string') {
      return false;
    }

    return authorization.trim().toLowerCase().startsWith('bearer ');
  }

  private async resolveActivationResult(
    result: GuardActivationResult,
  ): Promise<boolean> {
    if (typeof result === 'boolean') {
      return result;
    }

    if (isObservable(result)) {
      return lastValueFrom(result);
    }

    return result;
  }
}
