import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Admin AI execution cancellation contract', () => {
  const root = resolve(__dirname, '../../..');
  const read = (relative: string) =>
    readFileSync(resolve(root, relative), 'utf8');

  it('exposes one authorized AI cancellation endpoint and delegates to the governed service', () => {
    const controller = read('modules/admin/admin.controller.ts');
    const service = read('modules/admin/services/admin-queue.service.ts');

    expect(controller).toContain("@Post('queues/ai/jobs/:jobId/cancel')");
    expect(controller).toContain('this.assertAdminQueueManager(req)');
    expect(controller).toContain('this.getUserId(req)');
    expect(controller).toContain('dto.reason');
    expect(service).toContain('this.queueMonitorService.cancelAiExecution(');
    expect(service).toContain('this.aiQueueProcessor.cancelActiveJob(');
  });

  it('preserves evidence and routes cancellation away from retry and dead-letter failure handling', () => {
    const monitor = read('core/queue/services/queue-monitor.service.ts');
    const processor = read('modules/ai/processors/ai-queue.processor.ts');
    const utility = read(
      'core/queue/utils/queue-execution-cancellation.util.ts',
    );

    expect(monitor).toContain('evidenceRetained: true');
    expect(monitor).toContain('withCancellationLock');
    expect(monitor).toContain('idempotent');
    expect(processor).toContain(
      'QueueExecutionCancellationUtil.isCancellation',
    );
    expect(processor).toContain('job.discard()');
    expect(processor).toContain('deadLetterCaptured: false');
    expect(processor).not.toContain('captureFailure(cancellation');
    expect(utility).toContain("status: 'SUPERSEDED'");
    expect(utility).toContain('createLinkedTimeoutSignal');
  });

  it('propagates cooperative AbortSignal through catalog research and Ollama without fallback', () => {
    const queueProcessor = read('modules/ai/processors/ai-queue.processor.ts');
    const catalog = read('modules/ai/services/catalog-web-research.service.ts');
    const official = read(
      'modules/ai/services/official-product-page-resolver.service.ts',
    );
    const provider = read('modules/ai/providers/ollama-ai.provider.ts');
    const client = read('modules/ai/services/ollama-client.service.ts');

    expect(queueProcessor).toContain('{ signal }');
    expect(catalog).toMatch(
      /discover\(\s*identity,\s*\{\s*signal,?\s*\},?\s*\)/,
    );
    expect(catalog).toContain('createLinkedTimeoutSignal');
    expect(official).toContain('signal?: AbortSignal');
    expect(official).toContain('signal,');
    expect(provider).toContain('signal: options.signal');
    expect(provider).toContain('QueueExecutionCancellationUtil.isCancellation');
    expect(client).toContain('externalSignal?: AbortSignal');
    expect(client).toContain(
      'QueueExecutionCancellationUtil.throwIfAborted(externalSignal)',
    );
  });
});
