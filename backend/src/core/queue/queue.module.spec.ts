import { BullRegistrar, getQueueToken } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ALL_QUEUE_NAMES } from './constants/queue.constants';
import { CoreQueueModule } from './queue.module';
import { isDisabledQueueReference } from './services/queue-runtime.service';

describe('CoreQueueModule disabled lifecycle', () => {
  const originalQueueEnabled = process.env.QUEUE_ENABLED;

  beforeEach(() => {
    process.env.QUEUE_ENABLED = 'false';
  });

  afterEach(() => {
    if (originalQueueEnabled === undefined) {
      delete process.env.QUEUE_ENABLED;
    } else {
      process.env.QUEUE_ENABLED = originalQueueEnabled;
    }
  });

  it('boots and closes without creating Redis-backed queues or workers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
        CoreQueueModule,
      ],
    }).compile();

    const bullRegistrar = moduleRef.get(BullRegistrar, { strict: false });
    const registerSpy = jest.spyOn(bullRegistrar, 'register');

    await moduleRef.init();

    try {
      for (const queueName of ALL_QUEUE_NAMES) {
        const queue: unknown = moduleRef.get(getQueueToken(queueName));

        expect(isDisabledQueueReference(queue)).toBe(true);
      }

      expect(registerSpy).not.toHaveBeenCalled();
    } finally {
      await moduleRef.close();
    }
  });
});
