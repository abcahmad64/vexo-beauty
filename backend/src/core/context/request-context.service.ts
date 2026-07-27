import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  readonly requestId: string;
  readonly correlationId: string;
  readonly startedAt: number;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(this.normalizeStore(store), callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  getCorrelationId(): string | undefined {
    return this.getStore()?.correlationId;
  }

  getStartedAt(): number | undefined {
    return this.getStore()?.startedAt;
  }

  getDurationMs(): number | undefined {
    const startedAt = this.getStartedAt();

    if (
      typeof startedAt !== 'number' ||
      !Number.isFinite(startedAt) ||
      startedAt <= 0
    ) {
      return undefined;
    }

    return Math.max(0, Date.now() - startedAt);
  }

  hasContext(): boolean {
    return this.getStore() !== undefined;
  }

  private normalizeStore(store: RequestContextStore): RequestContextStore {
    const requestId =
      this.normalizeString(store.requestId) ?? 'unknown-request';
    const correlationId =
      this.normalizeString(store.correlationId) ?? requestId;

    return {
      requestId,
      correlationId,
      startedAt: this.normalizeStartedAt(store.startedAt),
    };
  }

  private normalizeStartedAt(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return Date.now();
    }

    return Math.trunc(value);
  }

  private normalizeString(value: string): string | undefined {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
