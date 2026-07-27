import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  DEFAULT_AUDIT_LOG_FILE,
  LOG_CONTEXT,
} from '../constants/logging.constants';
import type { AuditLogInput } from '../interfaces/logging.interfaces';
import { LogSanitizerUtil } from '../utils/log-sanitizer.util';
import { StructuredLoggerService } from './structured-logger.service';

type ConfigPrimitive = string | number | boolean;

type AuditLogPayload = Readonly<{
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  actorType: string | null;
  outcome: AuditLogInput['outcome'];
  ip: string | null;
  userAgent: string | null;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

@Injectable()
export class AuditLoggerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    const payload = this.createPayload(input);

    this.logger.write({
      level: payload.outcome === 'success' ? 'log' : 'warn',
      context: LOG_CONTEXT.AUDIT,
      message:
        payload.outcome === 'success'
          ? 'رویداد حسابرسی با موفقیت ثبت شد.'
          : 'رویداد حسابرسی ناموفق ثبت شد.',
      metadata: payload,
    });

    if (!this.isAuditFileEnabled()) {
      return;
    }

    await this.safeAppendAuditFile(payload);
  }

  private createPayload(input: AuditLogInput): AuditLogPayload {
    const occurredAt = input.occurredAt ?? new Date();

    return {
      action: this.normalizeRequiredString(input.action, 'unknown_action'),
      resource: this.normalizeRequiredString(
        input.resource,
        'unknown_resource',
      ),
      resourceId: this.normalizeNullableString(input.resourceId),
      actorId: this.normalizeNullableString(input.actorId),
      actorType: this.normalizeNullableString(input.actorType),
      outcome: input.outcome,
      ip: this.normalizeNullableString(input.ip),
      userAgent: this.normalizeNullableString(input.userAgent),
      metadata: input.metadata ?? {},
      occurredAt: occurredAt.toISOString(),
    };
  }

  private async safeAppendAuditFile(payload: AuditLogPayload): Promise<void> {
    try {
      await this.appendAuditFile(payload);
    } catch (error) {
      this.logger.write({
        level: 'warn',
        context: LOG_CONTEXT.AUDIT,
        message: 'ثبت فایل لاگ حسابرسی ناموفق بود.',
        metadata: {
          filePath: this.getAuditFilePath(),
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

  private async appendAuditFile(payload: AuditLogPayload): Promise<void> {
    const filePath = this.getAuditFilePath();

    await mkdir(dirname(filePath), {
      recursive: true,
    });

    const line = `${JSON.stringify(LogSanitizerUtil.sanitize(payload))}\n`;

    await appendFile(filePath, line, {
      encoding: 'utf8',
    });
  }

  private isAuditFileEnabled(): boolean {
    return this.getBooleanConfig(
      ['AUDIT_LOG_FILE_ENABLED', 'logging.audit.fileEnabled'],
      false,
    );
  }

  private getAuditFilePath(): string {
    return (
      this.getFirstConfigValue([
        'AUDIT_LOG_FILE_PATH',
        'logging.audit.filePath',
      ]) ?? DEFAULT_AUDIT_LOG_FILE
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
