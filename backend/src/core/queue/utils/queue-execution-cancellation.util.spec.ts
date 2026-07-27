import { QUEUE_NAMES } from '../constants/queue.constants';
import type { AiQueueJobData } from '../types/queue.types';

import {
  QueueExecutionCancellationUtil,
  QueueExecutionCancelledError,
} from './queue-execution-cancellation.util';

const data: AiQueueJobData = {
  task: 'catalog.search',
  metadata: {
    createdAt: '2026-07-23T00:00:00.000Z',
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    requestId: 'request-1',
  },
};

describe('QueueExecutionCancellationUtil', () => {
  it('creates deterministic idempotent cancellation metadata with execution lineage', () => {
    const first = QueueExecutionCancellationUtil.createRequest({
      jobId: 'ai-job-1',
      actorId: 'admin-1',
      reason: ' توقف پردازش ',
      stateAtRequest: 'active',
      data,
      requestedAt: '2026-07-23T00:01:00.000Z',
    });
    const second = QueueExecutionCancellationUtil.createRequest({
      jobId: 'ai-job-1',
      actorId: 'admin-2',
      stateAtRequest: 'waiting',
      data,
      requestedAt: '2026-07-23T00:02:00.000Z',
    });

    expect(first).toMatchObject({
      version: '1.0.0',
      status: 'REQUESTED',
      queueName: QUEUE_NAMES.AI,
      jobId: 'ai-job-1',
      cancellationId: 'ai-cancel-9eef916be10f53488b733c8557599874',
      requestedBy: 'admin-1',
      reason: 'توقف پردازش',
      stateAtRequest: 'active',
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      activeSignalDispatched: false,
    });
    expect(second.cancellationId).toBe(first.cancellationId);
  });

  it('round-trips cancellation through job data, progress, and BullMQ signal reason', () => {
    const cancellation = QueueExecutionCancellationUtil.createRequest({
      jobId: 'ai-job-1',
      actorId: 'admin-1',
      stateAtRequest: 'active',
      data,
    });
    const dataWithCancellation = QueueExecutionCancellationUtil.applyToData(
      data,
      cancellation,
    );
    const progress = QueueExecutionCancellationUtil.applyToProgress(
      { percent: 42 },
      cancellation,
    );
    const controller = new AbortController();

    controller.abort(
      QueueExecutionCancellationUtil.serializeSignalReason(cancellation),
    );

    expect(
      QueueExecutionCancellationUtil.readFromData(dataWithCancellation),
    ).toEqual(cancellation);
    expect(QueueExecutionCancellationUtil.readFromProgress(progress)).toEqual(
      cancellation,
    );
    expect(
      QueueExecutionCancellationUtil.readFromSignal(controller.signal),
    ).toEqual(cancellation);
    expect(progress).toMatchObject({ percent: 42, cancellation });
  });

  it('marks cooperative cancellation terminal without converting it to retry or dead-letter failure', () => {
    const cancellation = QueueExecutionCancellationUtil.createRequest({
      jobId: 'ai-job-1',
      actorId: 'admin-1',
      stateAtRequest: 'active',
      data,
    });
    const completed = QueueExecutionCancellationUtil.complete(
      QueueExecutionCancellationUtil.markSignalDispatched(cancellation, true),
      'CANCELLED_DURING_EXECUTION',
      '2026-07-23T00:03:00.000Z',
    );
    const withCancellation = QueueExecutionCancellationUtil.applyToData(
      data,
      cancellation,
    );

    expect(completed).toMatchObject({
      status: 'CANCELLED',
      activeSignalDispatched: true,
      outcome: 'CANCELLED_DURING_EXECUTION',
      completedAt: '2026-07-23T00:03:00.000Z',
    });
    expect(() =>
      QueueExecutionCancellationUtil.throwIfCancellationRequested(
        withCancellation,
      ),
    ).toThrow(QueueExecutionCancelledError);
  });

  it('links external cancellation and timeout signals without confusing their causes', () => {
    jest.useFakeTimers();
    const external = new AbortController();
    const linked = QueueExecutionCancellationUtil.createLinkedTimeoutSignal(
      external.signal,
      1000,
    );

    external.abort('external-cancel');

    expect(linked.signal.aborted).toBe(true);
    expect(linked.signal.reason).toBe('external-cancel');
    expect(linked.didTimeout()).toBe(false);
    linked.cleanup();
    jest.useRealTimers();
  });
});
