import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { UserStatus } from '../../../generated/prisma';
import { AuthEventPublisher } from '../events/auth.event.publisher';

import { AuthService } from './auth.service';

const ADMIN_PASSWORD = 'Admin@123456';

type AuthUserRow = {
  id: string;
  email: string;
  phone: string | null;
  password: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  status: UserStatus;
  role_id: string;
  role_name: string;
  permissions: string[];
  created_at: Date;
  updated_at: Date;
};

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

describe('AuthService password login boundary', () => {
  const queryRaw = jest.fn();
  const transaction = jest.fn();
  const refreshTokenCreate = jest.fn();
  const userSessionCreate = jest.fn();
  const signAsync = jest.fn();
  const publishLoginFailed = jest.fn();
  const publishUserLoggedIn = jest.fn();

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.NODE_ENV = 'test';

    const transactionClient = {
      refreshToken: {
        create: refreshTokenCreate,
      },
      userSession: {
        create: userSessionCreate,
      },
    };

    transaction.mockImplementation((callback: unknown) => {
      return (callback as (tx: typeof transactionClient) => unknown)(
        transactionClient,
      );
    });

    refreshTokenCreate.mockResolvedValue({
      id: 'refresh-token-id',
    });

    userSessionCreate.mockResolvedValue({
      id: 'session-id',
    });

    signAsync.mockResolvedValue('access-token');

    const prisma = {
      $queryRaw: queryRaw,
      $transaction: transaction,
    } as unknown as PrismaService;

    const jwtService = {
      signAsync,
    } as unknown as JwtService;

    const eventPublisher = {
      publishLoginFailed,
      publishUserLoggedIn,
    } as unknown as AuthEventPublisher;

    service = new AuthService(prisma, jwtService, eventPublisher);
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

  it('rejects CUSTOMER password login even when a password hash exists', async () => {
    queryRaw.mockResolvedValue([await createUserRow('CUSTOMER')]);

    const dto = {
      email: 'customer@example.com',
      password: ADMIN_PASSWORD,
    };

    await expect(service.login(dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(publishUserLoggedIn).not.toHaveBeenCalled();
    expect(publishLoginFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
        reason: 'Invalid credentials',
      }),
    );
  });

  it.each(['ADMIN', 'SUPER_ADMIN'])(
    'allows %s password login',
    async (roleName) => {
      queryRaw.mockResolvedValue([await createUserRow(roleName)]);

      const dto = {
        email: 'admin@example.com',
        password: ADMIN_PASSWORD,
      };

      const result = await service.login(dto, {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result.user.roleName).toBe(roleName);
      expect(result.accessToken).toBe('access-token');
      expect(result.sessionId).toBe('session-id');
      expect(publishUserLoggedIn).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@example.com',
          sessionId: 'session-id',
        }),
      );
    },
  );
});

async function createUserRow(roleName: string): Promise<AuthUserRow> {
  return {
    id: `user-${roleName.toLowerCase()}`,
    email:
      roleName === 'CUSTOMER' ? 'customer@example.com' : 'admin@example.com',
    phone: null,
    password: await bcrypt.hash(ADMIN_PASSWORD, 4),
    first_name: 'Vexo',
    last_name: 'Admin',
    avatar_url: null,
    status: UserStatus.ACTIVE,
    role_id: `role-${roleName.toLowerCase()}`,
    role_name: roleName,
    permissions: roleName === 'CUSTOMER' ? [] : ['admin:*'],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}
