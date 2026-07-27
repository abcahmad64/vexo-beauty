import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  DEFAULT_SECURITY_LOG_FILE,
  LOG_CONTEXT,
} from '../constants/logging.constants';
import type { SecurityLogInput } from '../interfaces/logging.interfaces';
import { LogSanitizerUtil } from '../utils/log-sanitizer.util';
import { StructuredLoggerService } from './structured-logger.service';

type ConfigPrimitive = string | number | boolean;

type SecurityLogPayload = Readonly<{
  event: string;
  severity: SecurityLogInput['severity'];
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  resource: string | null;
  reason: string | null;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

@Injectable()
export class SecurityLoggerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async record(input: SecurityLogInput): Promise<void> {
    const payload = this.createPayload(input);

    this.logger.write({
      level: this.resolveLogLevelBySeverity(payload.severity),
      context: LOG_CONTEXT.SECURITY,
      message: 'رویداد امنیتی ثبت شد.',
      metadata: payload,
    });

    if (!this.isSecurityFileEnabled()) {
      return;
    }

    await this.safeAppendSecurityFile(payload);
  }

  async authenticationFailed(
    input: Omit<SecurityLogInput, 'event' | 'severity'>,
  ): Promise<void> {
    await this.record({
      ...input,
      event: 'authentication_failed',
      severity: 'medium',
    });
  }

  async authorizationDenied(
    input: Omit<SecurityLogInput, 'event' | 'severity'>,
  ): Promise<void> {
    await this.record({
      ...input,
      event: 'authorization_denied',
      severity: 'high',
    });
  }

  async suspiciousActivity(
    input: Omit<SecurityLogInput, 'event' | 'severity'>,
  ): Promise<void> {
    await this.record({
      ...input,
      event: 'suspicious_activity',
      severity: 'critical',
    });
  }

  private createPayload(input: SecurityLogInput): SecurityLogPayload {
    const occurredAt = input.occurredAt ?? new Date();

    return {
      event: this.normalizeRequiredString(
        input.event,
        'unknown_security_event',
      ),
      severity: input.severity,
      actorId: this.normalizeNullableString(input.actorId),
      ip: this.normalizeNullableString(input.ip),
      userAgent: this.normalizeNullableString(input.userAgent),
      resource: this.normalizeNullableString(input.resource),
      reason: this.normalizeNullableString(input.reason),
      metadata: input.metadata ?? {},
      occurredAt: occurredAt.toISOString(),
    };
  }

  private resolveLogLevelBySeverity(
    severity: SecurityLogInput['severity'],
  ): 'warn' | 'error' | 'fatal' {
    if (severity === 'critical') {
      return 'fatal';
    }

    if (severity === 'high') {
      return 'error';
    }

    return 'warn';
  }

  private async safeAppendSecurityFile(
    payload: SecurityLogPayload,
  ): Promise<void> {
    try {
      await this.appendSecurityFile(payload);
    } catch (error) {
      this.logger.write({
        level: 'warn',
        context: LOG_CONTEXT.SECURITY,
        message: 'ثبت فایل لاگ امنیتی ناموفق بود.',
        metadata: {
          filePath: this.getSecurityFilePath(),
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        },
      });
    }
  }

  private async appendSecurityFile(payload: SecurityLogPayload): Promise<void> {
    const filePath = this.getSecurityFilePath();

    await mkdir(dirname(filePath), {
      recursive: true,
    });

    const line = `${JSON.stringify(LogSanitizerUtil.sanitize(payload))}\n`;

    await appendFile(filePath, line, {
      encoding: 'utf8',
    });
  }

  private isSecurityFileEnabled(): boolean {
    return this.getBooleanConfig(
      ['SECURITY_LOG_FILE_ENABLED', 'logging.security.fileEnabled'],
      false,
    );
  }

  private getSecurityFilePath(): string {
    return (
      this.getFirstConfigValue([
        'SECURITY_LOG_FILE_PATH',
        'logging.security.filePath',
      ]) ?? DEFAULT_SECURITY_LOG_FILE
    );
  }

  private getFirstConfigValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const configValue = this.normalizeOptionalString(
        this.configService.get<ConfigPrimitive>(key),
      );

      if (configValue) {
        return configValue;
      }

      const envValue = this.normalizeOptionalString(process.env[key]);

      if (envValue) {
        return envValue;
      }
    }

    return undefined;
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

  private normalizeRequiredString(value: unknown, fallback: string): string {
    return this.normalizeOptionalString(value) ?? fallback;
  }

  private normalizeNullableString(value: unknown): string | null {
    return this.normalizeOptionalString(value) ?? null;
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }
}
