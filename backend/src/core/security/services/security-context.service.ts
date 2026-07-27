import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import {
  CORE_METADATA_KEYS,
  REQUEST_HEADERS,
} from '../../constants/core.constants';
import type {
  AuthenticatedRequest,
  AuthenticatedRequestUser,
} from '../../interfaces/authenticated-request.interface';
import type {
  SecurityClientInfo,
  SecurityContextReader,
  SecurityContextSnapshot,
} from '../interfaces/security.interfaces';

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class SecurityContextService implements SecurityContextReader {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  getRequest(context: ExecutionContext): AuthenticatedRequest | null {
    if (context.getType() !== 'http') {
      return null;
    }

    return context.switchToHttp().getRequest<AuthenticatedRequest>();
  }

  getUser(context: ExecutionContext): AuthenticatedRequestUser | null {
    return this.getRequest(context)?.user ?? null;
  }

  getUserId(context: ExecutionContext): string | null {
    const user = this.getUser(context);

    return (
      this.normalizeString(user?.id) ??
      this.normalizeString(user?.userId) ??
      this.normalizeString(user?.sub) ??
      this.normalizeString(user?.phone) ??
      this.normalizeString(user?.mobile) ??
      this.normalizeString(user?.email)
    );
  }

  getRoleName(context: ExecutionContext): string | null {
    const user = this.getUser(context);

    const roleName =
      this.normalizeString(user?.roleName) ??
      (typeof user?.role === 'string'
        ? this.normalizeString(user.role)
        : this.normalizeString(user?.role?.name));

    return roleName ? roleName.toUpperCase() : null;
  }

  getPermissions(context: ExecutionContext): readonly string[] {
    const permissions = this.getUser(context)?.permissions;

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return [];
    }

    return Array.from(
      new Set(
        permissions
          .map((permission) => this.normalizeString(permission))
          .filter((permission): permission is string => Boolean(permission)),
      ),
    );
  }

  isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(CORE_METADATA_KEYS.IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  getClientInfo(context: ExecutionContext): SecurityClientInfo | null {
    const request = this.getRequest(context);

    return request ? this.getClientInfoForRequest(request) : null;
  }

  getClientInfoForRequest(request: AuthenticatedRequest): SecurityClientInfo {
    return {
      ip: this.resolveIp(request),
      userAgent: this.getHeaderValue(request, 'user-agent'),
      requestId:
        this.normalizeString(request.requestId) ??
        this.getHeaderValue(request, REQUEST_HEADERS.REQUEST_ID),
      correlationId:
        this.normalizeString(request.correlationId) ??
        this.getHeaderValue(request, REQUEST_HEADERS.CORRELATION_ID),
    };
  }

  createSnapshot(context: ExecutionContext): SecurityContextSnapshot {
    return {
      isHttp: context.getType() === 'http',
      isPublic: this.isPublic(context),
      user: this.getUser(context),
      userId: this.getUserId(context),
      roleName: this.getRoleName(context),
      permissions: this.getPermissions(context),
      client: this.getClientInfo(context),
    };
  }

  private resolveIp(request: AuthenticatedRequest): string | null {
    if (this.shouldTrustProxy()) {
      const cloudflareIp = this.getHeaderValue(request, 'cf-connecting-ip');

      if (cloudflareIp) {
        return this.normalizeIp(cloudflareIp);
      }

      const realIp = this.getHeaderValue(request, 'x-real-ip');

      if (realIp) {
        return this.normalizeIp(realIp);
      }

      const forwardedFor = this.getHeaderValue(request, 'x-forwarded-for');

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

    return this.normalizeIp(request.ip ?? request.socket.remoteAddress ?? null);
  }

  private getHeaderValue(
    request: AuthenticatedRequest,
    headerName: string,
  ): string | null {
    const value = request.headers[headerName.toLowerCase()];

    if (Array.isArray(value)) {
      return (
        value.map((item) => item.trim()).find((item) => item.length > 0) ?? null
      );
    }

    return this.normalizeString(value);
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeIp(value: string | null | undefined): string | null {
    const normalizedValue = this.normalizeString(value)?.replace(
      /^::ffff:/u,
      '',
    );

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : null;
  }

  private shouldTrustProxy(): boolean {
    return this.getBooleanConfig(
      [
        'TRUST_PROXY',
        'RATE_LIMIT_TRUST_PROXY',
        'security.trustProxy',
        'rateLimit.trustProxy',
      ],
      false,
    );
  }

  private getBooleanConfig(
    keys: readonly string[],
    defaultValue: boolean,
  ): boolean {
    for (const key of keys) {
      const parsedFromConfig = this.parseBoolean(
        this.configService.get<ConfigPrimitive>(key),
      );

      if (parsedFromConfig !== null) {
        return parsedFromConfig;
      }

      const parsedFromEnv = this.parseBoolean(process.env[key]);

      if (parsedFromEnv !== null) {
        return parsedFromEnv;
      }
    }

    return defaultValue;
  }

  private parseBoolean(value: unknown): boolean | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    if (typeof value !== 'string' && typeof value !== 'bigint') {
      return null;
    }

    const normalizedValue =
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : value.toString().trim().toLowerCase();

    if (normalizedValue === '') {
      return null;
    }

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return null;
  }
}
