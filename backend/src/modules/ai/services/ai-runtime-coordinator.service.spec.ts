import type { AiCircuitBreakerService } from './ai-circuit-breaker.service';

import { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';

const ENV_KEYS = [
  'AI_RUNTIME_MAX_CONCURRENT',
  'AI_RUNTIME_MAX_QUEUE_DEPTH',
  'AI_RUNTIME_QUEUE_TIMEOUT_MS',
] as const;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

type CircuitExecuteInput = {
  provider: string;
  resource: string;
  operation: string;
};

type StringCircuitExecuteMock = jest.MockedFunction<
  (
    scope: CircuitExecuteInput,
    operation: () => Promise<string>,
  ) => Promise<string>
>;

type CircuitBreakerMock = {
  execute: StringCircuitExecuteMock;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (!resolvePromise || !rejectPromise) {
    throw new Error('Deferred promise handlers were not initialized.');
  }

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
};

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('AiRuntimeCoordinatorService', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    jest.useRealTimers();

    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();

    for (const key of ENV_KEYS) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('publishes the default runtime limits with no active execution', () => {
    const service = new AiRuntimeCoordinatorService();

    expect(service.getSnapshot()).toEqual({
      maxConcurrent: 1,
      activeCount: 0,
      queueDepth: 0,
      maxQueueDepth: 24,
      queueTimeoutMs: 300_000,
      activeExecutions: [],
    });
  });

  it('clamps environment configuration when the service is constructed', () => {
    process.env.AI_RUNTIME_MAX_CONCURRENT = '99';
    process.env.AI_RUNTIME_MAX_QUEUE_DEPTH = '0';
    process.env.AI_RUNTIME_QUEUE_TIMEOUT_MS = '9999999';

    const service = new AiRuntimeCoordinatorService();

    expect(service.getSnapshot()).toEqual({
      maxConcurrent: 2,
      activeCount: 0,
      queueDepth: 0,
      maxQueueDepth: 1,
      queueTimeoutMs: 900_000,
      activeExecutions: [],
    });
  });

  it('uses fallback values for non-finite environment configuration', () => {
    process.env.AI_RUNTIME_MAX_CONCURRENT = 'not-a-number';
    process.env.AI_RUNTIME_MAX_QUEUE_DEPTH = 'Infinity';
    process.env.AI_RUNTIME_QUEUE_TIMEOUT_MS = 'NaN';

    const service = new AiRuntimeCoordinatorService();

    expect(service.getSnapshot()).toEqual({
      maxConcurrent: 1,
      activeCount: 0,
      queueDepth: 0,
      maxQueueDepth: 24,
      queueTimeoutMs: 300_000,
      activeExecutions: [],
    });
  });

  it('tracks an active execution and releases its slot after success', async () => {
    const deferred = createDeferred<string>();
    const service = new AiRuntimeCoordinatorService();

    const resultPromise = service.run(
      {
        operation: 'GENERATION',
        model: 'qwen3.5:9b',
        taskType: 'PUBLIC_CHAT',
      },
      () => deferred.promise,
    );

    await flushPromises();

    const activeSnapshot = service.getSnapshot();
    const activeExecution = activeSnapshot.activeExecutions[0];

    if (!activeExecution) {
      throw new Error('Expected one active execution.');
    }

    expect(activeSnapshot.activeCount).toBe(1);
    expect(activeSnapshot.queueDepth).toBe(0);
    expect(activeSnapshot.activeExecutions).toHaveLength(1);
    expect(activeExecution.id).toBe(1);
    expect(activeExecution.operation).toBe('GENERATION');
    expect(activeExecution.model).toBe('qwen3.5:9b');
    expect(activeExecution.taskType).toBe('PUBLIC_CHAT');
    expect(Date.parse(activeExecution.startedAt)).not.toBeNaN();
    expect(activeExecution.queueWaitMs).toBeGreaterThanOrEqual(0);

    deferred.resolve('completed');

    await expect(resultPromise).resolves.toBe('completed');

    expect(service.getSnapshot()).toEqual({
      maxConcurrent: 1,
      activeCount: 0,
      queueDepth: 0,
      maxQueueDepth: 24,
      queueTimeoutMs: 300_000,
      activeExecutions: [],
    });
  });

  it('releases the active slot when the operation rejects', async () => {
    const deferred = createDeferred<string>();
    const service = new AiRuntimeCoordinatorService();

    const resultPromise = service.run(
      {
        operation: 'EMBEDDING',
        model: 'qwen3-embedding:4b',
      },
      () => deferred.promise,
    );

    await flushPromises();

    expect(service.getSnapshot().activeCount).toBe(1);

    deferred.reject(new Error('provider offline'));

    await expect(resultPromise).rejects.toThrow('provider offline');

    expect(service.getSnapshot().activeCount).toBe(0);
    expect(service.getSnapshot().activeExecutions).toEqual([]);
  });

  it('starts queued executions in FIFO order as slots are released', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const third = createDeferred<string>();
    const started: string[] = [];

    const service = new AiRuntimeCoordinatorService();

    const firstPromise = service.run(
      {
        operation: 'GENERATION',
        model: 'model-1',
      },
      () => {
        started.push('first');
        return first.promise;
      },
    );

    const secondPromise = service.run(
      {
        operation: 'GENERATION',
        model: 'model-2',
      },
      () => {
        started.push('second');
        return second.promise;
      },
    );

    const thirdPromise = service.run(
      {
        operation: 'EMBEDDING',
        model: 'model-3',
      },
      () => {
        started.push('third');
        return third.promise;
      },
    );

    await flushPromises();

    expect(started).toEqual(['first']);
    expect(service.getSnapshot().activeCount).toBe(1);
    expect(service.getSnapshot().queueDepth).toBe(2);

    first.resolve('first-result');
    await expect(firstPromise).resolves.toBe('first-result');
    await flushPromises();

    expect(started).toEqual(['first', 'second']);
    expect(service.getSnapshot().activeExecutions[0]?.model).toBe('model-2');
    expect(service.getSnapshot().queueDepth).toBe(1);

    second.resolve('second-result');
    await expect(secondPromise).resolves.toBe('second-result');
    await flushPromises();

    expect(started).toEqual(['first', 'second', 'third']);
    expect(service.getSnapshot().activeExecutions[0]?.model).toBe('model-3');
    expect(service.getSnapshot().queueDepth).toBe(0);

    third.resolve('third-result');
    await expect(thirdPromise).resolves.toBe('third-result');

    expect(service.getSnapshot().activeCount).toBe(0);
  });

  it('rejects immediately when the configured queue depth is full', async () => {
    process.env.AI_RUNTIME_MAX_QUEUE_DEPTH = '1';

    const active = createDeferred<string>();
    const queued = createDeferred<string>();
    const rejectedOperation = jest.fn(() => Promise.resolve('must-not-run'));
    const service = new AiRuntimeCoordinatorService();

    const activePromise = service.run(
      {
        operation: 'GENERATION',
        model: 'active-model',
      },
      () => active.promise,
    );

    const queuedPromise = service.run(
      {
        operation: 'GENERATION',
        model: 'queued-model',
      },
      () => queued.promise,
    );

    await flushPromises();

    expect(service.getSnapshot().queueDepth).toBe(1);

    await expect(
      service.run(
        {
          operation: 'GENERATION',
          model: 'rejected-model',
        },
        rejectedOperation,
      ),
    ).rejects.toThrow(
      'صف پردازش هوش مصنوعی موقتاً تکمیل است. لطفاً چند لحظه دیگر تلاش کنید.',
    );

    expect(rejectedOperation).not.toHaveBeenCalled();

    active.resolve('active-result');
    await expect(activePromise).resolves.toBe('active-result');

    queued.resolve('queued-result');
    await expect(queuedPromise).resolves.toBe('queued-result');
  });

  it('removes and rejects a waiter after the queue timeout', async () => {
    jest.useFakeTimers();
    process.env.AI_RUNTIME_QUEUE_TIMEOUT_MS = '1000';

    const active = createDeferred<string>();
    const queuedOperation = jest.fn(() => Promise.resolve('queued-result'));
    const service = new AiRuntimeCoordinatorService();

    const activePromise = service.run(
      {
        operation: 'GENERATION',
        model: 'active-model',
      },
      () => active.promise,
    );

    const queuedPromise = service.run(
      {
        operation: 'GENERATION',
        model: 'queued-model',
      },
      queuedOperation,
    );

    await flushPromises();

    expect(service.getSnapshot().queueDepth).toBe(1);

    const queuedExpectation = expect(queuedPromise).rejects.toThrow(
      'زمان انتظار در صف پردازش هوش مصنوعی بیش از حد مجاز شد.',
    );

    await jest.advanceTimersByTimeAsync(1000);
    await queuedExpectation;

    expect(queuedOperation).not.toHaveBeenCalled();
    expect(service.getSnapshot().queueDepth).toBe(0);
    expect(service.getSnapshot().activeCount).toBe(1);

    active.resolve('active-result');
    await expect(activePromise).resolves.toBe('active-result');

    expect(service.getSnapshot().activeCount).toBe(0);
  });

  it('delegates execution to the optional circuit breaker with the expected scope', async () => {
    const execute: StringCircuitExecuteMock = jest.fn(
      (
        _scope: CircuitExecuteInput,
        operation: () => Promise<string>,
      ): Promise<string> => operation(),
    );

    const circuitBreaker: CircuitBreakerMock = {
      execute,
    };

    const service = new AiRuntimeCoordinatorService(
      circuitBreaker as unknown as AiCircuitBreakerService,
    );

    const result = await service.run(
      {
        operation: 'EMBEDDING',
        model: 'qwen3-embedding:4b',
        taskType: 'EMBEDDING',
      },
      () => Promise.resolve('embedded'),
    );

    expect(result).toBe('embedded');
    expect(execute).toHaveBeenCalledTimes(1);

    const call = execute.mock.calls[0];

    if (!call) {
      throw new Error('Expected circuit breaker execution call.');
    }

    expect(call[0]).toEqual({
      provider: 'ollama',
      resource: 'qwen3-embedding:4b',
      operation: 'EMBEDDING',
    });

    expect(service.getSnapshot().activeCount).toBe(0);
    expect(service.getSnapshot().activeExecutions).toEqual([]);
  });
});
