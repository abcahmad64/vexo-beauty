import { HEALTH_STATUS } from '../constants/health.constants';

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export type HealthDependencyName =
  'database' | 'redis' | 'queue' | 'storage' | 'ai';

export type HealthDetailValue =
  string | number | boolean | null | readonly string[];

export type HealthDetails = Readonly<Record<string, HealthDetailValue>>;

export interface HealthCheckResult {
  readonly name: HealthDependencyName;
  readonly label: string;
  readonly status: HealthStatus;
  readonly critical: boolean;
  readonly message: string;
  readonly latencyMs: number;
  readonly checkedAt: string;
  readonly details: HealthDetails;
}

export interface HealthAggregateResponse {
  readonly service: string;
  readonly status: HealthStatus;
  readonly healthy: boolean;
  readonly message: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly checks: readonly HealthCheckResult[];
}

export interface HealthLivenessResponse {
  readonly service: string;
  readonly status: HealthStatus;
  readonly healthy: true;
  readonly message: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

export interface HealthVersionResponse {
  readonly service: string;
  readonly status: HealthStatus;
  readonly healthy: true;
  readonly message: string;
  readonly version: string;
  readonly environment: string;
  readonly nodeVersion: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

export type RedisConnectionSource =
  'REDIS_URL' | 'REDIS_HOST' | 'QUEUE_REDIS_URL' | 'QUEUE_REDIS_HOST';

export interface RedisConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly username: string | null;
  readonly password: string | null;
  readonly db: number;
  readonly tls: boolean;
  readonly source: RedisConnectionSource;
  readonly displayAddress: string;
}

export interface BunnyStorageConfig {
  readonly zoneName: string;
  readonly accessKey: string;
  readonly baseUrl: string;
  readonly displayUrl: string;
  readonly cdnUrl: string | null;
}

export interface AiHealthConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly configured: boolean;
}

export interface HttpResponseSummary {
  readonly statusCode: number;
  readonly bodyPreview: string;
}

export interface HttpRequestOptions {
  readonly method: 'GET' | 'HEAD';
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}
