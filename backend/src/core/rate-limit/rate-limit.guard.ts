import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { ErrorCode } from '../errors/error-code.enum';
import { SecurityLoggerService } from '../logging/services/security-logger.service';
import {
  RATE_LIMIT_HEADERS,
  RATE_LIMIT_METADATA,
} from './constants/rate-limit.constants';
import { RateLimitConfigService } from './services/rate-limit-config.service';
import { RateLimitKeyService } from './services/rate-limit-key.service';
import { RateLimitStorageService } from './services/rate-limit-storage.service';
import type {
  RateLimitCustomOptions,
  RateLimitDecision,
  RateLimitProfile,
} from './types/rate-limit.types';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: RateLimitConfigService,
    private readonly keyService: RateLimitKeyService,
    private readonly storageService: RateLimitStorageService,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const config = this.configService.getConfig();

    if (!config.enabled) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const route = this.keyService.resolveRoute(request);

    if (this.shouldSkip(context) || this.configService.isPathSkipped(route)) {
      return true;
    }

    const options = this.resolveOptions(context);
    const profile = this.resolveEffectiveProfile(context, request, options);
    const rule = this.configService.resolveRule(profile, options);
    const trackers = this.keyService.resolveTrackers(
      request,
      profile,
      config.trustProxy,
    );
    const method = request.method.toUpperCase();

    const decisions = await Promise.all(
      trackers.map((tracker) => {
        const key = this.keyService.buildKey({
          keyPrefix: config.keyPrefix,
          profile,
          tracker,
          method,
          route,
        });

        return this.storageService.increment({
          key,
          profile,
          tracker,
          limit: rule.limit,
          ttlMs: rule.ttlMs,
          blockMs: rule.blockMs,
        });
      }),
    );

    const decision = this.selectEffectiveDecision(decisions);

    this.setRateLimitHeaders(response, {
      limit: decision.limit,
      remaining: decision.remaining,
      resetAt: decision.resetAt,
      profile: decision.profile,
      retryAfterMs: decision.retryAfterMs,
    });

    if (decision.allowed) {
      return true;
    }

    await this.recordExceededLimit({
      request,
      method,
      route,
      profile,
      reason: rule.message,
      totalHits: decision.totalHits,
      limit: decision.limit,
      retryAfterMs: decision.retryAfterMs,
    });

    throw new HttpException(
      {
        success: false,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.TOO_MANY_REQUESTS,
        message: rule.message,
        error: 'درخواست بیش از حد مجاز',
        details: {
          profile,
          limit: decision.limit,
          totalHits: decision.totalHits,
          retryAfterSeconds: Math.ceil(decision.retryAfterMs / 1_000),
          resetAt: decision.resetAt.toISOString(),
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private selectEffectiveDecision(
    decisions: readonly RateLimitDecision[],
  ): RateLimitDecision {
    const blockedDecisions = decisions.filter((decision) => !decision.allowed);

    if (blockedDecisions.length > 0) {
      return blockedDecisions.reduce((selected, candidate) => {
        if (candidate.retryAfterMs > selected.retryAfterMs) {
          return candidate;
        }

        if (
          candidate.retryAfterMs === selected.retryAfterMs &&
          candidate.totalHits > selected.totalHits
        ) {
          return candidate;
        }

        return selected;
      });
    }

    return decisions.reduce((selected, candidate) => {
      if (candidate.remaining < selected.remaining) {
        return candidate;
      }

      if (
        candidate.remaining === selected.remaining &&
        candidate.resetAt.getTime() > selected.resetAt.getTime()
      ) {
        return candidate;
      }

      return selected;
    });
  }

  private shouldSkip(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_METADATA.SKIP, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private resolveEffectiveProfile(
    context: ExecutionContext,
    request: Request,
    options: RateLimitCustomOptions | undefined,
  ): RateLimitProfile {
    return (
      options?.profile ??
      this.resolveProfile(context) ??
      this.keyService.inferProfile(request)
    );
  }

  private resolveProfile(context: ExecutionContext): RateLimitProfile | null {
    return (
      this.reflector.getAllAndOverride<RateLimitProfile>(
        RATE_LIMIT_METADATA.PROFILE,
        [context.getHandler(), context.getClass()],
      ) ?? null
    );
  }

  private resolveOptions(
    context: ExecutionContext,
  ): RateLimitCustomOptions | undefined {
    return this.reflector.getAllAndOverride<RateLimitCustomOptions>(
      RATE_LIMIT_METADATA.OPTIONS,
      [context.getHandler(), context.getClass()],
    );
  }

  private setRateLimitHeaders(
    response: Response,
    input: {
      readonly limit: number;
      readonly remaining: number;
      readonly resetAt: Date;
      readonly profile: RateLimitProfile;
      readonly retryAfterMs: number;
    },
  ): void {
    response.setHeader(RATE_LIMIT_HEADERS.LIMIT, String(input.limit));
    response.setHeader(RATE_LIMIT_HEADERS.REMAINING, String(input.remaining));
    response.setHeader(RATE_LIMIT_HEADERS.RESET, input.resetAt.toISOString());
    response.setHeader(RATE_LIMIT_HEADERS.PROFILE, input.profile);

    if (input.retryAfterMs > 0) {
      response.setHeader(
        RATE_LIMIT_HEADERS.RETRY_AFTER,
        String(Math.ceil(input.retryAfterMs / 1_000)),
      );
    }
  }

  private async recordExceededLimit(input: {
    readonly request: Request;
    readonly method: string;
    readonly route: string;
    readonly profile: RateLimitProfile;
    readonly reason: string;
    readonly totalHits: number;
    readonly limit: number;
    readonly retryAfterMs: number;
  }): Promise<void> {
    try {
      await this.securityLogger.record({
        event: 'rate_limit_exceeded',
        severity:
          input.profile === 'auth' || input.profile === 'sensitive'
            ? 'high'
            : 'medium',
        actorId: this.resolveActorId(input.request),
        ip: this.keyService.resolveIp(
          input.request,
          this.configService.getConfig().trustProxy,
        ),
        userAgent: this.resolveUserAgent(input.request),
        resource: `${input.method} ${input.route}`,
        reason: input.reason,
        metadata: {
          profile: input.profile,
          totalHits: input.totalHits,
          limit: input.limit,
          retryAfterMs: input.retryAfterMs,
        },
      });
    } catch {
      return;
    }
  }

  private resolveActorId(request: Request): string | undefined {
    return this.keyService.resolveUserId(request) ?? undefined;
  }

  private resolveUserAgent(request: Request): string | undefined {
    const value = request.headers['user-agent'];

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
