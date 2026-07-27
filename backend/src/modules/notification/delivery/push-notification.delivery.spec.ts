import { ConfigService } from '@nestjs/config';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { PushNotificationDelivery } from './push-notification.delivery';

type PrismaMock = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

type WebPushMock = {
  setVapidDetails: jest.Mock;
  sendNotification: jest.Mock;
};

type TestGlobal = typeof globalThis & {
  __vexoWebPushMock?: WebPushMock;
};

jest.mock('web-push', () => {
  const mock: WebPushMock = {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  };

  (globalThis as TestGlobal).__vexoWebPushMock = mock;

  return mock;
});

const payload = {
  notificationId: 'notification-1',
  userId: 'user-1',
  title: 'سفارش ارسال شد',
  message: 'سفارش شما تحویل پست شد.',
  type: 'ORDER_UPDATE',
  channel: NotificationDeliveryChannel.PUSH,
  metadata: {
    actionUrl: '/account/orders/order-1',
  },
  occurredAt: new Date('2026-07-14T00:00:00.000Z'),
};

function getWebPushMock(): WebPushMock {
  const mock = (globalThis as TestGlobal).__vexoWebPushMock;

  if (!mock) {
    throw new Error('Web Push mock was not initialized.');
  }

  return mock;
}

function config(enabled: boolean): ConfigService {
  const values: Record<string, string | boolean> = {
    PUSH_ENABLED: enabled,
    VAPID_PUBLIC_KEY: 'public-key',
    VAPID_PRIVATE_KEY: 'private-key',
    VAPID_SUBJECT: 'mailto:push@example.com',
  };

  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function subscription() {
  return {
    id: 'subscription-1',
    endpoint: 'https://push.example.com/subscriptions/one',
    p256dh: 'public-key',
    auth: 'auth-secret',
  };
}

describe('PushNotificationDelivery', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const webPushMock = getWebPushMock();

    webPushMock.setVapidDetails.mockReset();
    webPushMock.sendNotification.mockReset();
  });

  it('does not query subscriptions when push delivery is disabled', async () => {
    const delivery = new PushNotificationDelivery(
      config(false),
      prisma as never,
    );

    await expect(delivery.deliver(payload)).resolves.toEqual(
      expect.objectContaining({
        delivered: false,
        provider: 'web-push',
      }),
    );

    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    expect(getWebPushMock().sendNotification).not.toHaveBeenCalled();
  });

  it('marks an expired 410 subscription inactive', async () => {
    prisma.$queryRaw.mockResolvedValue([subscription()]);

    getWebPushMock().sendNotification.mockRejectedValue({
      statusCode: 410,
      message: 'Subscription expired',
    });

    const delivery = new PushNotificationDelivery(
      config(true),
      prisma as never,
    );

    const result = await delivery.deliver(payload);

    expect(result.delivered).toBe(false);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

    expect(getWebPushMock().setVapidDetails).toHaveBeenCalledWith(
      'mailto:push@example.com',
      'public-key',
      'private-key',
    );
  });

  it('marks a successful subscription as recently used', async () => {
    prisma.$queryRaw.mockResolvedValue([subscription()]);

    getWebPushMock().sendNotification.mockResolvedValue({});

    const delivery = new PushNotificationDelivery(
      config(true),
      prisma as never,
    );

    await expect(delivery.deliver(payload)).resolves.toEqual(
      expect.objectContaining({
        delivered: true,
        provider: 'web-push',
      }),
    );

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
