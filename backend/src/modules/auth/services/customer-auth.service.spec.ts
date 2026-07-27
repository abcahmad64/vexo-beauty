import { ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { UserStatus } from '../../../generated/prisma';
import { SmsNotificationDelivery } from '../../notification/delivery/sms-notification.delivery';
import { AuthEventPublisher } from '../events/auth.event.publisher';

import { CustomerAuthService } from './customer-auth.service';

const ORIGINAL_AUTH_TEST_ENV = {
  nodeEnv: process.env.NODE_ENV,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
} as const;

function restoreEnvironmentValue(
  key: 'NODE_ENV' | 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET',
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[key];

    return;
  }

  process.env[key] = value;
}

describe('CustomerAuthService OTP delivery contract', () => {
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const transaction = jest.fn();
  const sendQueuedSms = jest.fn();
  const publishUserRegistered = jest.fn();

  let service: CustomerAuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.NODE_ENV = 'production';

    queryRaw.mockResolvedValue([
      {
        count: 0,
      },
    ]);

    const transactionClient = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    transaction.mockImplementation((callback: unknown) => {
      return (callback as (tx: typeof transactionClient) => unknown)(
        transactionClient,
      );
    });

    const prisma = {
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
      $transaction: transaction,
    } as unknown as PrismaService;

    const jwtService = {
      signAsync: jest.fn(),
    } as unknown as JwtService;

    const smsDelivery = {
      sendQueuedSms,
    } as unknown as SmsNotificationDelivery;

    const eventPublisher = {
      publishUserRegistered,
    } as unknown as AuthEventPublisher;

    service = new CustomerAuthService(
      prisma,
      jwtService,
      smsDelivery,
      eventPublisher,
    );
  });

  afterAll(() => {
    restoreEnvironmentValue('NODE_ENV', ORIGINAL_AUTH_TEST_ENV.nodeEnv);
    restoreEnvironmentValue(
      'JWT_ACCESS_SECRET',
      ORIGINAL_AUTH_TEST_ENV.accessSecret,
    );
    restoreEnvironmentValue(
      'JWT_REFRESH_SECRET',
      ORIGINAL_AUTH_TEST_ENV.refreshSecret,
    );
  });

  it('returns success only after SMS delivery is accepted', async () => {
    sendQueuedSms.mockResolvedValue({
      channel: 'sms',
      delivered: true,
      provider: 'test-provider',
      messageId: 'sms-id',
      error: null,
    });

    const result = await service.requestOtp(
      {
        phone: '۰۹۱۲۱۲۳۴۵۶۷',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        phone: '+989121234567',
        expiresInSeconds: 120,
      }),
    );
    expect(result).not.toHaveProperty('devOtpCode');
    expect(sendQueuedSms).toHaveBeenCalledTimes(1);

    const sendQueuedSmsCalls = sendQueuedSms.mock.calls as unknown[][];
    const queuedSmsRequest = sendQueuedSmsCalls[0]?.[0];

    expect(queuedSmsRequest).toMatchObject({
      to: '+989121234567',
      template: 'customer-login-otp',
      payload: {
        purpose: 'CUSTOMER_LOGIN',
        expiresInSeconds: 120,
      },
    });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('invalidates the issued OTP when production SMS delivery fails', async () => {
    sendQueuedSms.mockResolvedValue({
      channel: 'sms',
      delivered: false,
      provider: 'test-provider',
      messageId: null,
      error: 'provider unavailable',
    });
    executeRaw.mockResolvedValue(1);

    await expect(
      service.requestOtp({
        phone: '09121234567',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit dev-code fallback only in test or development', async () => {
    process.env.NODE_ENV = 'test';

    sendQueuedSms.mockResolvedValue({
      channel: 'sms',
      delivered: false,
      provider: 'test-provider',
      messageId: null,
      error: 'disabled',
    });

    const result = await service.requestOtp({
      phone: '09121234567',
    });

    expect(result).toMatchObject({
      success: true,
      message: 'کد تأیید محیط توسعه ایجاد شد.',
    });
    expect(result.devOtpCode).toMatch(/^\d{6}$/u);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('publishes registration exactly once for a newly created OTP customer', async () => {
    const phone = '+989121234567';
    const code = '123456';
    const now = new Date();

    const internals = service as unknown as {
      hashOtp(phoneValue: string, codeValue: string): string;
      findLatestPendingOtp: jest.Mock;
      consumeOtp: jest.Mock;
      findOrCreateCustomerByPhone: jest.Mock;
      issueTokens: jest.Mock;
    };

    internals.findLatestPendingOtp = jest.fn().mockResolvedValue({
      id: 'otp-id',
      code_hash: internals.hashOtp(phone, code),
      attempts: 0,
      expires_at: new Date(now.getTime() + 60_000),
    });
    internals.consumeOtp = jest.fn().mockResolvedValue(undefined);
    internals.findOrCreateCustomerByPhone = jest.fn().mockResolvedValue({
      created: true,
      user: {
        id: 'customer-id',
        email: null,
        phone,
        password: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
        status: UserStatus.ACTIVE,
        role_id: 'customer-role-id',
        role_name: 'CUSTOMER',
        permissions: ['products:read'],
        created_at: now,
        updated_at: now,
      },
    });
    internals.issueTokens = jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshExpiresAt: new Date(now.getTime() + 86_400_000),
      sessionId: 'session-id',
    });

    const result = await service.verifyOtp(
      {
        phone,
        code,
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    );

    expect(result.user.id).toBe('customer-id');
    expect(publishUserRegistered).toHaveBeenCalledTimes(1);
    expect(publishUserRegistered).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-id',
        phone,
      }),
    );
    expect(publishUserRegistered.mock.invocationCallOrder[0]).toBeLessThan(
      internals.issueTokens.mock.invocationCallOrder[0],
    );
  });
});
