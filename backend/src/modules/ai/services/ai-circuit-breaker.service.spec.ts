import { ServiceUnavailableException } from '@nestjs/common';

import { AiCircuitBreakerService } from './ai-circuit-breaker.service';

describe('AiCircuitBreakerService', () => {
  const envKeys = [
    'AI_CIRCUIT_FAILURE_THRESHOLD',
    'AI_CIRCUIT_COOLDOWN_MS',
    'AI_CIRCUIT_HALF_OPEN_MAX_CALLS',
  ] as const;

  const originalEnv = new Map<string, string | undefined>();

  const scope = {
    provider: 'ollama',
    resource: 'primary-model',
    operation: 'GENERATION',
  };

  beforeAll(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    process.env.AI_CIRCUIT_FAILURE_THRESHOLD = '2';
    process.env.AI_CIRCUIT_COOLDOWN_MS = '1000';
    process.env.AI_CIRCUIT_HALF_OPEN_MAX_CALLS = '1';
  });

  afterEach(() => {
    jest.restoreAllMocks();

    for (const key of envKeys) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('keeps a healthy circuit closed after success', async () => {
    const service = new AiCircuitBreakerService();

    await expect(
      service.execute(scope, () => Promise.resolve('ok')),
    ).resolves.toBe('ok');

    const snapshot = service.getSnapshot();

    expect(snapshot.closedCircuits).toBe(1);
    expect(snapshot.openCircuits).toBe(0);
    expect(snapshot.circuits[0]).toMatchObject({
      state: 'CLOSED',
      consecutiveFailures: 0,
      totalSuccesses: 1,
    });
  });

  it('opens after the configured consecutive failure threshold', async () => {
    const service = new AiCircuitBreakerService();
    const operation = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(service.execute(scope, operation)).rejects.toThrow('offline');
    await expect(service.execute(scope, operation)).rejects.toThrow('offline');

    await expect(service.execute(scope, operation)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(operation).toHaveBeenCalledTimes(2);

    expect(service.getSnapshot().circuits[0]).toMatchObject({
      state: 'OPEN',
      consecutiveFailures: 2,
      totalFailures: 2,
      totalRejected: 1,
    });
  });

  it('moves to half-open after cooldown and closes on recovery', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1000);

    const service = new AiCircuitBreakerService();

    await expect(
      service.execute(scope, () => Promise.reject(new Error('failure-1'))),
    ).rejects.toThrow('failure-1');

    await expect(
      service.execute(scope, () => Promise.reject(new Error('failure-2'))),
    ).rejects.toThrow('failure-2');

    now.mockReturnValue(2500);

    await expect(
      service.execute(scope, () => Promise.resolve('recovered')),
    ).resolves.toBe('recovered');

    expect(service.getSnapshot().circuits[0]).toMatchObject({
      state: 'CLOSED',
      consecutiveFailures: 0,
      totalSuccesses: 1,
      totalFailures: 2,
    });
  });

  it('reopens immediately when the half-open probe fails', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1000);

    const service = new AiCircuitBreakerService();

    for (const message of ['failure-1', 'failure-2']) {
      await expect(
        service.execute(scope, () => Promise.reject(new Error(message))),
      ).rejects.toThrow(message);
    }

    now.mockReturnValue(2500);

    await expect(
      service.execute(scope, () => Promise.reject(new Error('probe-failed'))),
    ).rejects.toThrow('probe-failed');

    expect(service.getSnapshot().circuits[0]).toMatchObject({
      state: 'OPEN',
      consecutiveFailures: 3,
      totalFailures: 3,
      lastError: 'probe-failed',
    });
  });
});
