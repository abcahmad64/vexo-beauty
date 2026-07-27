import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

import {
  SECURITY_HEADERS,
  SECURITY_HEADER_VALUES,
  type CrossOriginResourcePolicy,
} from '../constants/security.constants';

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(_request: Request, response: Response, next: NextFunction): void {
    if (!this.isEnabled() || response.headersSent) {
      next();
      return;
    }

    this.setHeader(
      response,
      SECURITY_HEADERS.X_CONTENT_TYPE_OPTIONS,
      SECURITY_HEADER_VALUES.NOSNIFF,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.X_FRAME_OPTIONS,
      SECURITY_HEADER_VALUES.DENY,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.REFERRER_POLICY,
      SECURITY_HEADER_VALUES.NO_REFERRER,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.PERMISSIONS_POLICY,
      SECURITY_HEADER_VALUES.PERMISSIONS_POLICY,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.X_PERMITTED_CROSS_DOMAIN_POLICIES,
      SECURITY_HEADER_VALUES.NONE,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.CROSS_ORIGIN_OPENER_POLICY,
      SECURITY_HEADER_VALUES.SAME_ORIGIN,
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.CROSS_ORIGIN_RESOURCE_POLICY,
      this.getCrossOriginResourcePolicy(),
    );

    this.setHeader(
      response,
      SECURITY_HEADERS.X_XSS_PROTECTION,
      SECURITY_HEADER_VALUES.DISABLE_XSS_AUDITOR,
    );

    if (this.isHstsEnabled()) {
      this.setHeader(
        response,
        SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY,
        SECURITY_HEADER_VALUES.HSTS_ONE_YEAR_INCLUDE_SUBDOMAINS,
      );
    } else {
      response.removeHeader(SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY);
    }

    next();
  }

  private setHeader(response: Response, name: string, value: string): void {
    response.setHeader(name, value);
  }

  private isEnabled(): boolean {
    return this.getBooleanConfig(
      ['SECURITY_HEADERS_ENABLED', 'security.headers.enabled'],
      true,
    );
  }

  private isHstsEnabled(): boolean {
    return this.getBooleanConfig(
      ['SECURITY_HSTS_ENABLED', 'security.headers.hstsEnabled'],
      this.isProductionLike(),
    );
  }

  private isProductionLike(): boolean {
    const nodeEnv = this.getStringConfig(
      ['NODE_ENV', 'app.env'],
      'development',
    );

    return nodeEnv === 'production' || nodeEnv === 'staging';
  }

  private getCrossOriginResourcePolicy(): CrossOriginResourcePolicy {
    const value = this.getStringConfig(
      [
        'SECURITY_CROSS_ORIGIN_RESOURCE_POLICY',
        'security.headers.crossOriginResourcePolicy',
      ],
      SECURITY_HEADER_VALUES.SAME_ORIGIN,
    );

    if (
      value === SECURITY_HEADER_VALUES.SAME_ORIGIN ||
      value === SECURITY_HEADER_VALUES.SAME_SITE ||
      value === SECURITY_HEADER_VALUES.CROSS_ORIGIN
    ) {
      return value;
    }

    return SECURITY_HEADER_VALUES.SAME_ORIGIN;
  }

  private getStringConfig(
    keys: readonly string[],
    defaultValue: string,
  ): string {
    for (const key of keys) {
      const configValue = this.normalizeConfigString(
        this.configService.get<ConfigPrimitive>(key),
      );

      if (configValue) {
        return configValue;
      }

      const envValue = this.normalizeConfigString(process.env[key]);

      if (envValue) {
        return envValue;
      }
    }

    return defaultValue.trim().toLowerCase();
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

  private normalizeConfigString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim().toLowerCase();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim().toLowerCase();
    }

    return undefined;
  }
}
