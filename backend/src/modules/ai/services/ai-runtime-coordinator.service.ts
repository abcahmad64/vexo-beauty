import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AiCircuitBreakerService } from './ai-circuit-breaker.service';

export type AiRuntimeOperation = 'GENERATION' | 'EMBEDDING';

export interface AiRuntimeExecutionInput {
  operation: AiRuntimeOperation;
  model: string;
  taskType?: string;
}

type AiRuntimeWaiter = {
  start: () => void;
  reject: (reason: ServiceUnavailableException) => void;
  timer: NodeJS.Timeout;
};

type AiRuntimeActiveExecution = {
  id: number;
  operation: AiRuntimeOperation;
  model: string;
  taskType: string | null;
  startedAt: string;
  queueWaitMs: number;
};

@Injectable()
export class AiRuntimeCoordinatorService {
  private readonly maxConcurrent = this.readInteger(
    'AI_RUNTIME_MAX_CONCURRENT',
    1,
    1,
    2,
  );

  private readonly maxQueueDepth = this.readInteger(
    'AI_RUNTIME_MAX_QUEUE_DEPTH',
    24,
    1,
    200,
  );

  private readonly queueTimeoutMs = this.readInteger(
    'AI_RUNTIME_QUEUE_TIMEOUT_MS',
    300_000,
    1_000,
    900_000,
  );

  private activeCount = 0;

  private sequence = 0;

  private readonly waiters: AiRuntimeWaiter[] = [];

  private readonly activeExecutions = new Map<
    number,
    AiRuntimeActiveExecution
  >();

  constructor(
    @Optional()
    private readonly circuitBreaker?: AiCircuitBreakerService,
  ) {}

  async run<T>(
    input: AiRuntimeExecutionInput,
    operation: () => Promise<T>,
  ): Promise<T> {
    const queuedAt = Date.now();

    await this.acquire();

    const executionId = ++this.sequence;
    const queueWaitMs = Date.now() - queuedAt;

    this.activeExecutions.set(executionId, {
      id: executionId,
      operation: input.operation,
      model: input.model,
      taskType: input.taskType ?? null,
      startedAt: new Date().toISOString(),
      queueWaitMs,
    });

    try {
      if (!this.circuitBreaker) {
        return await operation();
      }

      return await this.circuitBreaker.execute(
        {
          provider: 'ollama',
          resource: input.model,
          operation: input.operation,
        },
        operation,
      );
    } finally {
      this.activeExecutions.delete(executionId);
      this.release();
    }
  }

  getSnapshot() {
    return {
      maxConcurrent: this.maxConcurrent,
      activeCount: this.activeCount,
      queueDepth: this.waiters.length,
      maxQueueDepth: this.maxQueueDepth,
      queueTimeoutMs: this.queueTimeoutMs,
      activeExecutions: [...this.activeExecutions.values()],
    };
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return Promise.resolve();
    }

    if (this.waiters.length >= this.maxQueueDepth) {
      throw new ServiceUnavailableException(
        'صف پردازش هوش مصنوعی موقتاً تکمیل است. لطفاً چند لحظه دیگر تلاش کنید.',
      );
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: AiRuntimeWaiter = {
        start: () => {
          clearTimeout(waiter.timer);
          this.activeCount += 1;
          resolve();
        },
        reject,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);

          if (index >= 0) {
            this.waiters.splice(index, 1);
          }

          reject(
            new ServiceUnavailableException(
              'زمان انتظار در صف پردازش هوش مصنوعی بیش از حد مجاز شد.',
            ),
          );
        }, this.queueTimeoutMs),
      };

      this.waiters.push(waiter);
    });
  }

  private release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);

    const next = this.waiters.shift();

    if (next) {
      next.start();
    }
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
}
