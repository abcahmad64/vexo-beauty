import { Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_LOG_LEVEL_BY_ENV,
  LOG_CONTEXT,
  LOG_FORMAT,
  LOG_LEVEL_PRIORITY,
} from '../constants/logging.constants';
import type { LogFormat, LogLevel } from '../constants/logging.constants';
import type {
  LoggingRuntimeConfig,
  LogMetadata,
  StructuredLogEntry,
  StructuredLogInput,
} from '../interfaces/logging.interfaces';
import { LogSanitizerUtil } from '../utils/log-sanitizer.util';

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly runtimeConfig: LoggingRuntimeConfig;

  constructor(private readonly configService: ConfigService) {
    this.runtimeConfig = this.resolveRuntimeConfig();
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFromNestLogger('fatal', message, optionalParams);
  }

  write(input: StructuredLogInput): void {
    if (!this.shouldLog(input.level)) {
      return;
    }

    const entry = this.createEntry(input);
    const output =
      this.runtimeConfig.format === LOG_FORMAT.PRETTY
        ? this.formatPretty(entry)
        : this.formatJson(entry);

    this.writeToConsole(input.level, output);
  }

  private createEntry(input: StructuredLogInput): StructuredLogEntry {
    const entry: {
      timestamp: string;
      level: LogLevel;
      service: string;
      environment: string;
      context: string;
      message: string;
      trace?: string;
      metadata?: unknown;
    } = {
      timestamp:
        this.normalizeString(input.timestamp) ?? new Date().toISOString(),
      level: input.level,
      service: this.runtimeConfig.serviceName,
      environment: this.runtimeConfig.environment,
      context: this.normalizeString(input.context) ?? LOG_CONTEXT.SYSTEM,
      message: this.normalizeString(input.message) ?? '',
    };

    const trace = this.normalizeString(input.trace);

    if (trace) {
      entry.trace = trace;
    }

    if (input.metadata) {
      entry.metadata = LogSanitizerUtil.sanitize(input.metadata);
    }

    return entry;
  }

  private writeFromNestLogger(
    level: LogLevel,
    message: unknown,
    optionalParams: readonly unknown[],
  ): void {
    const extracted = this.extractOptionalParams(level, optionalParams);

    this.write({
      level,
      message: this.messageToString(message),
      context: extracted.context,
      trace: extracted.trace,
      metadata: extracted.metadata,
    });
  }

  private extractOptionalParams(
    level: LogLevel,
    optionalParams: readonly unknown[],
  ): {
    readonly context: string;
    readonly trace?: string;
    readonly metadata?: LogMetadata;
  } {
    let context: string = LOG_CONTEXT.SYSTEM;
    let trace: string | undefined;
    const metadataRecords: Record<string, unknown>[] = [];

    for (const param of optionalParams) {
      if (typeof param === 'string') {
        if (level === 'error' || level === 'fatal') {
          if (!trace) {
            trace = param;
            continue;
          }

          context = param;
          continue;
        }

        context = param;
        continue;
      }

      if (this.isRecord(param)) {
        metadataRecords.push(param);
      }
    }

    return {
      context,
      trace,
      metadata:
        metadataRecords.length > 0
          ? (Object.assign({}, ...metadataRecords) as Record<string, unknown>)
          : undefined,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.runtimeConfig.level]
    );
  }

  private messageToString(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(LogSanitizerUtil.sanitize(message));
    } catch {
      return String(message);
    }
  }

  private formatJson(entry: StructuredLogEntry): string {
    return JSON.stringify(LogSanitizerUtil.sanitize(entry));
  }

  private formatPretty(entry: StructuredLogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      entry.level.toUpperCase(),
      `[${entry.context}]`,
      entry.message,
    ];

    if (entry.trace) {
      parts.push(entry.trace);
    }

    if (entry.metadata) {
      parts.push(JSON.stringify(entry.metadata));
    }

    return parts.join(' ');
  }

  private writeToConsole(level: LogLevel, output: string): void {
    if (level === 'error' || level === 'fatal') {
      console.error(output);
      return;
    }

    if (level === 'warn') {
      console.warn(output);
      return;
    }

    console.log(output);
  }

  private resolveRuntimeConfig(): LoggingRuntimeConfig {
    const environment =
      this.getFirstConfigValue(['app.env', 'NODE_ENV']) ?? 'development';

    const serviceName =
      this.getFirstConfigValue(['app.name', 'APP_NAME', 'SERVICE_NAME']) ??
      'VEXO Beauty Backend';

    const defaultLevel = this.resolveDefaultLogLevel(environment);

    const level = this.resolveLogLevel(
      this.getFirstConfigValue([
        'LOG_LEVEL',
        'logging.level',
        'app.logLevel',
      ]) ?? defaultLevel,
    );

    const configuredFormat = this.resolveLogFormat(
      this.getFirstConfigValue([
        'LOG_FORMAT',
        'logging.format',
        'app.logFormat',
      ]) ?? LOG_FORMAT.JSON,
    );

    const pretty = this.getBooleanConfig(
      ['LOG_PRETTY', 'logging.pretty'],
      configuredFormat === LOG_FORMAT.PRETTY,
    );

    return {
      level,
      format: pretty ? LOG_FORMAT.PRETTY : configuredFormat,
      serviceName,
      environment,
      pretty,
    };
  }

  private resolveDefaultLogLevel(environment: string): LogLevel {
    const normalizedEnvironment = environment.trim().toLowerCase();

    if (normalizedEnvironment in DEFAULT_LOG_LEVEL_BY_ENV) {
      return DEFAULT_LOG_LEVEL_BY_ENV[
        normalizedEnvironment as keyof typeof DEFAULT_LOG_LEVEL_BY_ENV
      ];
    }

    return 'debug';
  }

  private resolveLogLevel(value: string): LogLevel {
    const normalizedValue = value.trim().toLowerCase();

    if (this.isLogLevel(normalizedValue)) {
      return normalizedValue;
    }

    return 'debug';
  }

  private resolveLogFormat(value: string): LogFormat {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === LOG_FORMAT.PRETTY) {
      return LOG_FORMAT.PRETTY;
    }

    return LOG_FORMAT.JSON;
  }

  private isLogLevel(value: string): value is LogLevel {
    return value in LOG_LEVEL_PRIORITY;
  }

  private getFirstConfigValue(keys: readonly string[]): string | undefined {
    for (const key of keys) {
      const configValue = this.normalizeString(
        this.configService.get<ConfigPrimitive>(key),
      );

      if (configValue) {
        return configValue;
      }

      const envValue = this.normalizeString(process.env[key]);

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

  private normalizeString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
