import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { validate } from 'class-validator';

import { DeletePushSubscriptionDto } from './delete-push-subscription.dto';

import { RegisterPushSubscriptionDto } from './register-push-subscription.dto';

function input(endpoint = 'https://push.example.com/subscriptions/one') {
  return {
    endpoint,
    keys: {
      p256dh: 'BDummyPublicKeyValueForValidation',
      auth: 'DummyAuthSecret',
    },
  };
}

describe('RegisterPushSubscriptionDto', () => {
  it('accepts a trimmed HTTPS push endpoint with non-empty keys', async () => {
    const dto = plainToInstance(RegisterPushSubscriptionDto, {
      ...input('  https://push.example.com/subscriptions/one  '),
      keys: {
        p256dh: '  BDummyPublicKeyValueForValidation  ',
        auth: '  DummyAuthSecret  ',
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);

    expect(dto.endpoint).toBe('https://push.example.com/subscriptions/one');

    expect(dto.keys).toEqual({
      p256dh: 'BDummyPublicKeyValueForValidation',
      auth: 'DummyAuthSecret',
    });
  });

  it('rejects non-HTTPS subscription endpoints', async () => {
    const dto = plainToInstance(
      RegisterPushSubscriptionDto,
      input('http://push.example.com/subscriptions/one'),
    );

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'endpoint')).toBe(true);
  });

  it('rejects empty subscription key material after trimming', async () => {
    const dto = plainToInstance(RegisterPushSubscriptionDto, {
      ...input(),
      keys: {
        p256dh: '   ',
        auth: '',
      },
    });

    const errors = await validate(dto);

    const keysError = errors.find((error) => error.property === 'keys');

    expect(keysError?.children?.map((child) => child.property)).toEqual(
      expect.arrayContaining(['p256dh', 'auth']),
    );
  });
});

describe('DeletePushSubscriptionDto', () => {
  it('accepts a trimmed HTTPS endpoint', async () => {
    const dto = plainToInstance(DeletePushSubscriptionDto, {
      endpoint: '  https://push.example.com/subscriptions/one  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);

    expect(dto.endpoint).toBe('https://push.example.com/subscriptions/one');
  });

  it('rejects an empty or non-HTTPS endpoint', async () => {
    const empty = plainToInstance(DeletePushSubscriptionDto, {
      endpoint: '   ',
    });

    const insecure = plainToInstance(DeletePushSubscriptionDto, {
      endpoint: 'http://push.example.com/subscriptions/one',
    });

    await expect(validate(empty)).resolves.not.toHaveLength(0);

    await expect(validate(insecure)).resolves.not.toHaveLength(0);
  });
});
