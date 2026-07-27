import type { LogFormat, LogLevel } from '../constants/logging.constants';

export type LogMetadata = Readonly<Record<string, unknown>>;

export interface StructuredLogInput {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: string;
  readonly trace?: string;
  readonly metadata?: LogMetadata;
  readonly timestamp?: string;
}

export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly environment: string;
  readonly context: string;
  readonly message: string;
  readonly trace?: string;
  readonly metadata?: unknown;
}

export interface LoggingRuntimeConfig {
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly serviceName: string;
  readonly environment: string;
  readonly pretty: boolean;
}

export interface RequestLogMetadata {
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly method: string;
  readonly url: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly contentLength: string | null;
}

export type AuditLogOutcome = 'success' | 'failure';

export type SecurityLogSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogInput {
  readonly action: string;
  readonly resource: string;
  readonly resourceId?: string | null;
  readonly actorId?: string | null;
  readonly actorType?: string | null;
  readonly outcome: AuditLogOutcome;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly metadata?: LogMetadata;
  readonly occurredAt?: Date;
}

export interface SecurityLogInput {
  readonly event: string;
  readonly severity: SecurityLogSeverity;
  readonly actorId?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly resource?: string | null;
  readonly reason?: string | null;
  readonly metadata?: LogMetadata;
  readonly occurredAt?: Date;
}
