import { PushSubscriptionService } from './push-subscription.service';

type PrismaMock = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

function row() {
  return {
    id: 'subscription-1',
    userId: 'user-1',
    endpoint: 'https://push.example.com/subscriptions/one',
    p256dh: 'public-key',
    auth: 'auth-secret',
    userAgent: 'Browser',
    ipAddress: '127.0.0.1',
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date('2026-07-14T00:00:00.000Z'),
    updatedAt: new Date('2026-07-14T00:00:00.000Z'),
    deletedAt: null,
  };
}

describe('PushSubscriptionService', () => {
  let prisma: PrismaMock;
  let service: PushSubscriptionService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    service = new PushSubscriptionService(prisma as never);
  });

  it('registers the authenticated browser without exposing key material', async () => {
    prisma.$queryRaw.mockResolvedValue([row()]);

    const result = await service.register(
      'user-1',
      {
        endpoint: 'https://push.example.com/subscriptions/one',
        keys: {
          p256dh: 'public-key',
          auth: 'auth-secret',
        },
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'Browser',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'subscription-1',
        userId: 'user-1',
        endpoint: 'https://push.example.com/subscriptions/one',
        isActive: true,
      }),
    );

    expect(result).not.toHaveProperty('p256dh');

    expect(result).not.toHaveProperty('auth');

    expect(result).not.toHaveProperty('ipAddress');
  });

  it('lists only the public subscription summary contract', async () => {
    prisma.$queryRaw.mockResolvedValue([row()]);

    const result = await service.findAllForUser('user-1');

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'subscription-1',
        endpoint: 'https://push.example.com/subscriptions/one',
        isActive: true,
      }),
    );

    expect(result[0]).not.toHaveProperty('p256dh');

    expect(result[0]).not.toHaveProperty('auth');

    expect(result[0]).not.toHaveProperty('userAgent');
  });

  it('deactivates only the authenticated user endpoint and stays idempotent', async () => {
    prisma.$executeRaw.mockResolvedValue(0);

    await expect(
      service.deleteForUser('user-1', {
        endpoint: 'https://push.example.com/subscriptions/one',
      }),
    ).resolves.toEqual({
      success: true,
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
