import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type AiCircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AiCircuitBreakerScope {
  provider: string;
  resource: string;
  operation: string;
}

type AiCircuitEntry = {
  key: string;
  provider: string;
  resource: string;
  operation: string;
  state: AiCircuitBreakerState;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  totalRejected: number;
  openedAt: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  halfOpenInFlight: number;
};

@Injectable()
export class AiCircuitBreakerService {
  private readonly failureThreshold = this.readInteger(
    'AI_CIRCUIT_FAILURE_THRESHOLD',
    3,
    1,
    20,
  );

  private readonly cooldownMs = this.readInteger(
    'AI_CIRCUIT_COOLDOWN_MS',
    60_000,
    1_000,
    900_000,
  );

  private readonly halfOpenMaxCalls = this.readInteger(
    'AI_CIRCUIT_HALF_OPEN_MAX_CALLS',
    1,
    1,
    5,
  );

  private readonly circuits = new Map<string, AiCircuitEntry>();

  async execute<T>(
    scope: AiCircuitBreakerScope,
    operation: () => Promise<T>,
  ): Promise<T> {
    const entry = this.getOrCreate(scope);
    const startedInHalfOpen = this.prepareExecution(entry);

    try {
      const result = await operation();

      this.recordSuccess(entry);

      return result;
    } catch (error) {
      this.recordFailure(entry, error);

      throw error;
    } finally {
      if (startedInHalfOpen) {
        entry.halfOpenInFlight = Math.max(0, entry.halfOpenInFlight - 1);
      }
    }
  }

  getSnapshot() {
    const circuits = [...this.circuits.values()]
      .map((entry) => ({
        key: entry.key,
        provider: entry.provider,
        resource: entry.resource,
        operation: entry.operation,
        state: entry.state,
        consecutiveFailures: entry.consecutiveFailures,
        totalSuccesses: entry.totalSuccesses,
        totalFailures: entry.totalFailures,
        totalRejected: entry.totalRejected,
        openedAt:
          entry.openedAt === null
            ? null
            : new Date(entry.openedAt).toISOString(),
        lastFailureAt:
          entry.lastFailureAt === null
            ? null
            : new Date(entry.lastFailureAt).toISOString(),
        lastSuccessAt:
          entry.lastSuccessAt === null
            ? null
            : new Date(entry.lastSuccessAt).toISOString(),
        lastError: entry.lastError,
        halfOpenInFlight: entry.halfOpenInFlight,
      }))
      .sort((left, right) => left.key.localeCompare(right.key));

    return {
      config: {
        failureThreshold: this.failureThreshold,
        cooldownMs: this.cooldownMs,
        halfOpenMaxCalls: this.halfOpenMaxCalls,
      },
      totalCircuits: circuits.length,
      openCircuits: circuits.filter((item) => item.state === 'OPEN').length,
      halfOpenCircuits: circuits.filter((item) => item.state === 'HALF_OPEN')
        .length,
      closedCircuits: circuits.filter((item) => item.state === 'CLOSED').length,
      circuits,
    };
  }

  reset(scope?: AiCircuitBreakerScope): void {
    if (!scope) {
      this.circuits.clear();
      return;
    }

    this.circuits.delete(this.buildKey(scope));
  }

  private prepareExecution(entry: AiCircuitEntry): boolean {
    const now = Date.now();

    if (entry.state === 'OPEN') {
      const elapsed = entry.openedAt === null ? 0 : now - entry.openedAt;

      if (elapsed < this.cooldownMs) {
        entry.totalRejected += 1;

        throw new ServiceUnavailableException(
          `مدار حفاظتی سرویس هوش مصنوعی برای ${entry.resource} موقتاً باز است.`,
        );
      }

      entry.state = 'HALF_OPEN';
      entry.halfOpenInFlight = 0;
    }

    if (entry.state === 'HALF_OPEN') {
      if (entry.halfOpenInFlight >= this.halfOpenMaxCalls) {
        entry.totalRejected += 1;

        throw new ServiceUnavailableException(
          `مدار حفاظتی سرویس هوش مصنوعی برای ${entry.resource} در حال آزمون بازیابی است.`,
        );
      }

      entry.halfOpenInFlight += 1;

      return true;
    }

    return false;
  }

  private recordSuccess(entry: AiCircuitEntry): void {
    entry.state = 'CLOSED';
    entry.consecutiveFailures = 0;
    entry.totalSuccesses += 1;
    entry.openedAt = null;
    entry.lastSuccessAt = Date.now();
    entry.lastError = null;
  }

  private recordFailure(entry: AiCircuitEntry, error: unknown): void {
    const now = Date.now();

    entry.totalFailures += 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = now;
    entry.lastError = this.getErrorMessage(error).slice(0, 500);

    if (
      entry.state === 'HALF_OPEN' ||
      entry.consecutiveFailures >= this.failureThreshold
    ) {
      entry.state = 'OPEN';
      entry.openedAt = now;
    }
  }

  private getOrCreate(scope: AiCircuitBreakerScope): AiCircuitEntry {
    const key = this.buildKey(scope);
    const existing = this.circuits.get(key);

    if (existing) {
      return existing;
    }

    const entry: AiCircuitEntry = {
      key,
      provider: this.normalizePart(scope.provider),
      resource: this.normalizePart(scope.resource),
      operation: this.normalizePart(scope.operation),
      state: 'CLOSED',
      consecutiveFailures: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalRejected: 0,
      openedAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
      lastError: null,
      halfOpenInFlight: 0,
    };

    this.circuits.set(key, entry);

    return entry;
  }

  private buildKey(scope: AiCircuitBreakerScope): string {
    return [
      this.normalizePart(scope.provider),
      this.normalizePart(scope.resource),
      this.normalizePart(scope.operation),
    ].join(':');
  }

  private normalizePart(value: string): string {
    const normalized = String(value).trim().toLowerCase();

    return normalized || 'unknown';
  }

  private readInteger(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : fallback;

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.trunc(Math.min(max, Math.max(min, parsed)));
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
