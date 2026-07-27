import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';

import type {
  RateLimitProfile,
  RateLimitUserIdentity,
} from '../types/rate-limit.types';

type HeaderValue = string | string[] | undefined;

type RequestWithUnknownBody = Request & {
  readonly body?: unknown;
  readonly user?: RateLimitUserIdentity;
};

@Injectable()
export class RateLimitKeyService {
  buildKey(input: {
    readonly keyPrefix: string;
    readonly profile: RateLimitProfile;
    readonly tracker: string;
    readonly method: string;
    readonly route: string;
  }): string {
    return [
      input.keyPrefix,
      input.profile,
      this.hash(input.tracker),
      input.method.toUpperCase(),
      this.hash(input.route),
    ].join(':');
  }

  resolveTracker(
    request: RequestWithUnknownBody,
    profile: RateLimitProfile,
    trustProxy: boolean,
  ): string {
    const [tracker] = this.resolveTrackers(request, profile, trustProxy);

    if (!tracker) {
      throw new Error('Rate-limit tracker resolution failed.');
    }

    return tracker;
  }

  resolveTrackers(
    request: RequestWithUnknownBody,
    profile: RateLimitProfile,
    trustProxy: boolean,
  ): readonly string[] {
    const ip = this.resolveIp(request, trustProxy);
    const ipTracker = `ip:${this.hash(ip)}`;

    if (profile === 'auth') {
      const credentialHash = this.resolveCredentialHash(request.body);
      const trackers = [ipTracker];

      if (credentialHash) {
        trackers.push(`credential:${credentialHash}`);
      }

      return [...new Set(trackers)];
    }

    const userId = this.resolveUserId(request);
    const tokenHash = this.resolveAuthorizationTokenHash(request);
    const actorPart = userId ?? tokenHash ?? `guest:${this.hash(ip)}`;

    return [`${actorPart}:${ipTracker}`];
  }

  resolveUserId(request: RequestWithUnknownBody): string | null {
    const user = request.user;

    if (!user) {
      return null;
    }

    const candidates = [
      user.id,
      user.userId,
      user.sub,
      user.phone,
      user.mobile,
      user.email,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return `user:${this.normalizeIdentity(candidate)}`;
      }
    }

    return null;
  }

  resolveIp(request: Request, trustProxy: boolean): string {
    if (trustProxy) {
      const cfConnectingIp = this.firstHeaderValue(
        request.headers['cf-connecting-ip'],
      );

      if (cfConnectingIp) {
        return this.normalizeIp(cfConnectingIp);
      }

      const realIp = this.firstHeaderValue(request.headers['x-real-ip']);

      if (realIp) {
        return this.normalizeIp(realIp);
      }

      const forwardedFor = this.firstHeaderValue(
        request.headers['x-forwarded-for'],
      );

      if (forwardedFor) {
        const firstForwardedIp = forwardedFor
          .split(',')
          .map((item) => item.trim())
          .find((item) => item.length > 0);

        if (firstForwardedIp) {
          return this.normalizeIp(firstForwardedIp);
        }
      }
    }

    return this.normalizeIp(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  resolveRoute(request: Request): string {
    const routePath = this.resolveExpressRoutePath(request);

    if (routePath) {
      return this.normalizeRoutePath(routePath);
    }

    const originalUrl = request.originalUrl || request.url || '/';

    return this.normalizeRoutePath(originalUrl.split('?')[0] ?? '/');
  }

  inferProfile(request: Request): RateLimitProfile {
    const method = request.method.toUpperCase();
    const route = this.resolveRoute(request).toLowerCase();

    if (
      route.includes('/auth/login') ||
      route.includes('/auth/register') ||
      route.includes('/auth/refresh') ||
      route.includes('/auth/forgot-password') ||
      route.includes('/auth/reset-password') ||
      route.includes('/auth/customer/request-otp') ||
      route.includes('/auth/customer/verify-otp')
    ) {
      return 'auth';
    }

    if (route.includes('/ai') || route.includes('/admin/ai')) {
      return 'ai';
    }

    if (
      route.includes('/upload') ||
      route.includes('/uploads') ||
      route.includes('/media')
    ) {
      return 'upload';
    }

    if (route.includes('/admin') || route.startsWith('/api/admin')) {
      return 'admin';
    }

    if (
      route.includes('/search') ||
      route.includes('/suggestion') ||
      route.includes('/suggestions')
    ) {
      return 'search';
    }

    if (
      method !== 'GET' &&
      (route.includes('/payment') ||
        route.includes('/refund') ||
        route.includes('/order') ||
        route.includes('/shipment') ||
        route.includes('/invoice') ||
        route.includes('/user') ||
        route.includes('/address') ||
        route.includes('/sessions') ||
        route.includes('/logout'))
    ) {
      return 'sensitive';
    }

    if (method === 'GET') {
      return 'public';
    }

    return 'default';
  }

  private resolveAuthorizationTokenHash(request: Request): string | null {
    const authorization = this.firstHeaderValue(request.headers.authorization);

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = authorization.slice(7).trim();

    if (token.length === 0) {
      return null;
    }

    return `token:${this.hash(token)}`;
  }

  private resolveCredentialHash(body: unknown): string | null {
    if (!this.isRecord(body)) {
      return null;
    }

    const identityKeys = ['phone', 'mobile', 'email', 'username', 'identifier'];

    for (const key of identityKeys) {
      const value = body[key];

      if (typeof value === 'string' && value.trim().length > 0) {
        return this.hash(this.normalizeIdentity(value));
      }
    }

    const refreshToken = body.refreshToken;

    if (typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
      return this.hash(refreshToken.trim());
    }

    return null;
  }

  private resolveExpressRoutePath(request: Request): string | null {
    const baseUrl = request.baseUrl ?? '';
    const route = this.readRecordProperty(request, 'route');
    const path = this.readRecordProperty(route, 'path');

    if (typeof path === 'string' && path.trim().length > 0) {
      return `${baseUrl}${path}`;
    }

    if (Array.isArray(path)) {
      const firstPath = path.find(
        (item): item is string =>
          typeof item === 'string' && item.trim().length > 0,
      );

      if (firstPath) {
        return `${baseUrl}${firstPath}`;
      }
    }

    return null;
  }

  private normalizeRoutePath(value: string): string {
    const withoutQuery = value.split('?')[0] ?? '/';
    const withLeadingSlash = withoutQuery.startsWith('/')
      ? withoutQuery
      : `/${withoutQuery}`;

    return (
      withLeadingSlash
        .replace(/\/[0-9]+(?=\/|$)/gu, '/:id')
        .replace(
          /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/giu,
          '/:id',
        )
        .replace(/\/+$/gu, '') || '/'
    );
  }

  private firstHeaderValue(value: HeaderValue): string | null {
    if (Array.isArray(value)) {
      const first = value.find((item) => item.trim().length > 0);

      return first?.trim() ?? null;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return null;
  }

  private normalizeIdentity(value: string): string {
    return this.normalizeDigits(value)
      .trim()
      .toLowerCase()
      .replace(/[\s\-()]/gu, '');
  }

  private normalizeDigits(value: string): string {
    return value
      .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 1632));
  }

  private normalizeIp(value: string): string {
    const normalizedValue = value.trim().replace(/^::ffff:/u, '');

    return normalizedValue.length > 0 ? normalizedValue : 'unknown';
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }

  private readRecordProperty(value: unknown, key: string): unknown {
    return this.isRecord(value) ? value[key] : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
