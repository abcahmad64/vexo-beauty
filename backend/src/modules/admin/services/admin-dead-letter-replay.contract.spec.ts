import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Admin dead-letter replay contract', () => {
  it('exposes only the governed dead-letter replay endpoint and retains the source record', () => {
    const root = process.cwd();
    const controller = readFileSync(
      join(root, 'src/modules/admin/admin.controller.ts'),
      'utf8',
    );
    const adminQueue = readFileSync(
      join(root, 'src/modules/admin/services/admin-queue.service.ts'),
      'utf8',
    );
    const monitor = readFileSync(
      join(root, 'src/core/queue/services/queue-monitor.service.ts'),
      'utf8',
    );

    expect(controller).toContain(
      "@Post('queues/dead-letter/jobs/:jobId/replay')",
    );
    expect(controller).toContain('this.assertAdminQueueManager(req)');
    expect(adminQueue).toContain('replayDeadLetterJob(jobId, actorId)');
    expect(monitor).toContain("QUEUE_DEAD_LETTER_REPLAY_VERSION = '1.0.0'");
    expect(monitor).toContain('dead-letter-replay-');
    expect(monitor).toContain('idempotentJobId: true');
    expect(monitor).toContain('retained: true');
    expect(monitor).toContain("source: 'admin.queue.dead-letter-replay'");
    expect(monitor).toContain('Replay بازگشتی به Dead Letter Queue مجاز نیست.');
    expect(monitor).not.toContain('sourceJob.remove()');
  });
});
