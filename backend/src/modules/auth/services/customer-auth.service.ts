import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { Prisma, UserStatus } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SmsNotificationDelivery } from '../../notification/delivery/sms-notification.delivery';
import { normalizePersianArabicDigits } from '../../../core/utils/transformer.util';
import { AuthConstants } from '../constants/auth.constants';
import { CustomerRequestOtpDto } from '../dto/customer-request-otp.dto';
import { CustomerVerifyOtpDto } from '../dto/customer-verify-otp.dto';
import { AuthEventPublisher } from '../events/auth.event.publisher';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type RequestMeta = {
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
};

type CountRow = {
  readonly count: number | bigint;
};

type OtpRow = {
  readonly id: string;
  readonly code_hash: string;
  readonly attempts: number;
  readonly expires_at: Date;
};

type UserAuthRow = {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly password: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly avatar_url: string | null;
  readonly status: UserStatus;
  readonly role_id: string | null;
  readonly role_name: string | null;
  readonly permissions: string[] | null;
  readonly created_at: Date;
  readonly updated_at: Date;
};

type CustomerResolution = {
  readonly user: UserAuthRow;
  readonly created: boolean;
};

type OtpQueryClient = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | '$executeRaw'
>;

type OtpVerificationStatus =
  'verified' | 'invalid' | 'expired' | 'too_many_attempts';

const CUSTOMER_AUTH_MESSAGES = {
  OTP_SENT: 'کد تأیید ارسال شد.',
  OTP_DEV_READY: 'کد تأیید محیط توسعه ایجاد شد.',
  OTP_DELIVERY_FAILED: 'ارسال کد تأیید موقتاً امکان‌پذیر نیست.',
  INVALID_PHONE: 'شماره موبایل معتبر نیست.',
  INVALID_OTP: 'کد تأیید معتبر نیست.',
  EXPIRED_OTP: 'کد تأیید منقضی شده است.',
  TOO_MANY_ATTEMPTS: 'تعداد تلاش‌ها بیش از حد مجاز است.',
  TOO_MANY_REQUESTS: 'تعداد درخواست کد تأیید بیش از حد مجاز است.',
  WAIT_BEFORE_RETRY: 'لطفاً کمی صبر کنید و دوباره تلاش کنید.',
  USER_NOT_ACTIVE: 'حساب کاربری فعال نیست.',
  USER_NOT_FOUND: 'کاربر یافت نشد.',
} as const;

@Injectable()
export class CustomerAuthService {
  private readonly otpPurpose = 'CUSTOMER_LOGIN';
  private readonly otpExpiresInSeconds = 120;
  private readonly maxOtpAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly smsDelivery: SmsNotificationDelivery,
    private readonly eventPublisher: AuthEventPublisher,
  ) {}

  async requestOtp(dto: CustomerRequestOtpDto, meta: RequestMeta = {}) {
    const phone = this.normalizeIranMobile(dto.phone);

    await this.assertOtpRequestAllowed(phone, meta);

    const otpId = randomUUID();
    const code = this.generateOtpCode();
    const codeHash = this.hashOtp(phone, code);
    const expiresAt = new Date(Date.now() + this.otpExpiresInSeconds * 1_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "PhoneOtp"
          SET
            "consumedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE "phone" = ${phone}
            AND "purpose" = ${this.otpPurpose}
            AND "consumedAt" IS NULL
        `,
      );

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "PhoneOtp" (
            "id",
            "phone",
            "purpose",
            "codeHash",
            "attempts",
            "expiresAt",
            "ipAddress",
            "userAgent",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${otpId},
            ${phone},
            ${this.otpPurpose},
            ${codeHash},
            0,
            ${expiresAt},
            ${meta.ipAddress ?? null},
            ${meta.userAgent ?? null},
            NOW(),
            NOW()
          )
        `,
      );
    });

    const delivered = await this.deliverOtp(phone, code, meta);
    const developmentFallback = !delivered && this.shouldExposeDevOtpCode();

    if (!delivered && !developmentFallback) {
      await this.consumeOtp(otpId);

      throw new ServiceUnavailableException(
        CUSTOMER_AUTH_MESSAGES.OTP_DELIVERY_FAILED,
      );
    }

    const response: Record<string, unknown> = {
      success: true,
      message: delivered
        ? CUSTOMER_AUTH_MESSAGES.OTP_SENT
        : CUSTOMER_AUTH_MESSAGES.OTP_DEV_READY,
      phone,
      expiresInSeconds: this.otpExpiresInSeconds,
    };

    if (this.shouldExposeDevOtpCode()) {
      response.devOtpCode = code;
    }

    return response;
  }

  async verifyOtp(dto: CustomerVerifyOtpDto, meta: RequestMeta = {}) {
    const phone = this.normalizeIranMobile(dto.phone);
    const code = this.normalizeDigits(dto.code);

    const verificationStatus = await this.prisma.$transaction(async (tx) => {
      const otp = await this.findLatestPendingOtp(phone, tx);

      if (!otp) {
        return 'invalid' satisfies OtpVerificationStatus;
      }

      if (otp.attempts >= this.maxOtpAttempts) {
        await this.consumeOtp(otp.id, tx);

        return 'too_many_attempts' satisfies OtpVerificationStatus;
      }

      if (otp.expires_at.getTime() < Date.now()) {
        await this.consumeOtp(otp.id, tx);

        return 'expired' satisfies OtpVerificationStatus;
      }

      const codeHash = this.hashOtp(phone, code);

      if (!this.safeCompareHash(codeHash, otp.code_hash)) {
        const attempts = await this.increaseOtpAttempt(otp.id, tx);

        if (attempts >= this.maxOtpAttempts) {
          await this.consumeOtp(otp.id, tx);

          return 'too_many_attempts' satisfies OtpVerificationStatus;
        }

        return 'invalid' satisfies OtpVerificationStatus;
      }

      await this.consumeOtp(otp.id, tx);

      return 'verified' satisfies OtpVerificationStatus;
    });

    if (verificationStatus === 'too_many_attempts') {
      throw new HttpException(
        CUSTOMER_AUTH_MESSAGES.TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (verificationStatus === 'expired') {
      throw new BadRequestException(CUSTOMER_AUTH_MESSAGES.EXPIRED_OTP);
    }

    if (verificationStatus !== 'verified') {
      throw new BadRequestException(CUSTOMER_AUTH_MESSAGES.INVALID_OTP);
    }

    const customer = await this.findOrCreateCustomerByPhone(phone);
    const user = customer.user;

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(CUSTOMER_AUTH_MESSAGES.USER_NOT_ACTIVE);
    }

    if (customer.created) {
      this.eventPublisher.publishUserRegistered({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        occurredAt: new Date(),
      });
    }

    const tokens = await this.issueTokens(user, meta);

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  private async deliverOtp(
    phone: string,
    code: string,
    meta: RequestMeta,
  ): Promise<boolean> {
    try {
      const result = await this.smsDelivery.sendQueuedSms({
        to: phone,
        template: 'customer-login-otp',
        payload: {
          message: this.createOtpMessage(code),
          purpose: this.otpPurpose,
          expiresInSeconds: this.otpExpiresInSeconds,
        },
        metadata: {
          source: 'auth.customer.otp',
          createdAt: new Date().toISOString(),
          ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
          ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
        },
      });

      return result.delivered;
    } catch {
      return false;
    }
  }

  private createOtpMessage(code: string): string {
    return (
      `کد تأیید ورود به وکسو بیوتی: ${code}\n` +
      `این کد تا ${this.otpExpiresInSeconds} ثانیه معتبر است.`
    );
  }

  private async assertOtpRequestAllowed(
    phone: string,
    meta: RequestMeta,
  ): Promise<void> {
    const recentRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "PhoneOtp"
        WHERE "phone" = ${phone}
          AND "purpose" = ${this.otpPurpose}
          AND "createdAt" > NOW() - INTERVAL '60 seconds'
      `,
    );

    if (this.toNumber(recentRows[0]?.count) > 0) {
      throw new HttpException(
        CUSTOMER_AUTH_MESSAGES.WAIT_BEFORE_RETRY,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hourlyRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "PhoneOtp"
        WHERE "phone" = ${phone}
          AND "purpose" = ${this.otpPurpose}
          AND "createdAt" > NOW() - INTERVAL '1 hour'
      `,
    );

    if (this.toNumber(hourlyRows[0]?.count) >= 10) {
      throw new HttpException(
        CUSTOMER_AUTH_MESSAGES.TOO_MANY_REQUESTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!meta.ipAddress) {
      return;
    }

    const ipRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "PhoneOtp"
        WHERE "ipAddress" = ${meta.ipAddress}
          AND "purpose" = ${this.otpPurpose}
          AND "createdAt" > NOW() - INTERVAL '1 hour'
      `,
    );

    if (this.toNumber(ipRows[0]?.count) >= 30) {
      throw new HttpException(
        CUSTOMER_AUTH_MESSAGES.TOO_MANY_REQUESTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async findLatestPendingOtp(
    phone: string,
    client: OtpQueryClient = this.prisma,
  ): Promise<OtpRow | null> {
    const rows = await client.$queryRaw<OtpRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "codeHash" AS code_hash,
          "attempts",
          "expiresAt" AS expires_at
        FROM "PhoneOtp"
        WHERE "phone" = ${phone}
          AND "purpose" = ${this.otpPurpose}
          AND "consumedAt" IS NULL
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `,
    );

    return rows[0] ?? null;
  }

  private async increaseOtpAttempt(
    otpId: string,
    client: OtpQueryClient = this.prisma,
  ): Promise<number> {
    const rows = await client.$queryRaw<Array<{ attempts: number }>>(
      Prisma.sql`
        UPDATE "PhoneOtp"
        SET
          "attempts" = "attempts" + 1,
          "updatedAt" = NOW()
        WHERE "id" = ${otpId}
          AND "consumedAt" IS NULL
        RETURNING "attempts"
      `,
    );

    return rows[0]?.attempts ?? this.maxOtpAttempts;
  }

  private async consumeOtp(
    otpId: string,
    client: OtpQueryClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw(
      Prisma.sql`
        UPDATE "PhoneOtp"
        SET
          "consumedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${otpId}
          AND "consumedAt" IS NULL
      `,
    );
  }

  private async findOrCreateCustomerByPhone(
    phone: string,
  ): Promise<CustomerResolution> {
    const existing = await this.findUserByPhone(phone);

    if (existing) {
      return {
        user: existing,
        created: false,
      };
    }

    const userId = randomUUID();
    const customerRoleId = await this.findDefaultCustomerRoleId();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "User" (
          "id",
          "email",
          "phone",
          "password",
          "firstName",
          "lastName",
          "avatarUrl",
          "status",
          "roleId",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${userId},
          NULL,
          ${phone},
          NULL,
          NULL,
          NULL,
          NULL,
          ${UserStatus.ACTIVE}::"UserStatus",
          ${customerRoleId},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      user: await this.findUserById(userId),
      created: true,
    };
  }

  private async findUserByPhone(phone: string): Promise<UserAuthRow | null> {
    const rows = await this.prisma.$queryRaw<UserAuthRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."phone",
          u."password",
          u."firstName" AS first_name,
          u."lastName" AS last_name,
          u."avatarUrl" AS avatar_url,
          u."status",
          u."roleId" AS role_id,
          r."name" AS role_name,
          COALESCE(
            ARRAY_AGG(DISTINCT p."name")
              FILTER (
                WHERE p."id" IS NOT NULL
                  AND p."deleted_at" IS NULL
              ),
            ARRAY[]::text[]
          ) AS permissions,
          u."createdAt" AS created_at,
          u."updatedAt" AS updated_at
        FROM "User" u
        LEFT JOIN "Role" r
          ON r."id" = u."roleId"
          AND r."deleted_at" IS NULL
        LEFT JOIN "RolePermission" rp
          ON rp."roleId" = r."id"
        LEFT JOIN "Permission" p
          ON p."id" = rp."permissionId"
          AND p."deleted_at" IS NULL
        WHERE u."phone" = ${phone}
          AND u."deleted_at" IS NULL
          AND u."status"::text <> 'DELETED'
        GROUP BY
          u."id",
          u."email",
          u."phone",
          u."password",
          u."firstName",
          u."lastName",
          u."avatarUrl",
          u."status",
          u."roleId",
          r."name",
          u."createdAt",
          u."updatedAt"
        LIMIT 1
      `,
    );

    return rows[0] ?? null;
  }

  private async findUserById(userId: string): Promise<UserAuthRow> {
    const rows = await this.prisma.$queryRaw<UserAuthRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."phone",
          u."password",
          u."firstName" AS first_name,
          u."lastName" AS last_name,
          u."avatarUrl" AS avatar_url,
          u."status",
          u."roleId" AS role_id,
          r."name" AS role_name,
          COALESCE(
            ARRAY_AGG(DISTINCT p."name")
              FILTER (
                WHERE p."id" IS NOT NULL
                  AND p."deleted_at" IS NULL
              ),
            ARRAY[]::text[]
          ) AS permissions,
          u."createdAt" AS created_at,
          u."updatedAt" AS updated_at
        FROM "User" u
        LEFT JOIN "Role" r
          ON r."id" = u."roleId"
          AND r."deleted_at" IS NULL
        LEFT JOIN "RolePermission" rp
          ON rp."roleId" = r."id"
        LEFT JOIN "Permission" p
          ON p."id" = rp."permissionId"
          AND p."deleted_at" IS NULL
        WHERE u."id" = ${userId}
          AND u."deleted_at" IS NULL
          AND u."status"::text <> 'DELETED'
        GROUP BY
          u."id",
          u."email",
          u."phone",
          u."password",
          u."firstName",
          u."lastName",
          u."avatarUrl",
          u."status",
          u."roleId",
          r."name",
          u."createdAt",
          u."updatedAt"
        LIMIT 1
      `,
    );

    if (!rows[0]) {
      throw new UnauthorizedException(CUSTOMER_AUTH_MESSAGES.USER_NOT_FOUND);
    }

    return rows[0];
  }

  private async findDefaultCustomerRoleId(): Promise<string | null> {
    const role = await this.prisma.role.findFirst({
      where: {
        name: {
          equals: AuthConstants.DEFAULT_CUSTOMER_ROLE,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    return role?.id ?? null;
  }

  private async issueTokens(user: UserAuthRow, meta: RequestMeta) {
    return this.prisma.$transaction((tx) => this.issueTokensTx(tx, user, meta));
  }

  private async issueTokensTx(
    tx: Prisma.TransactionClient,
    user: UserAuthRow,
    meta: RequestMeta,
  ) {
    const refreshToken = this.generateSecureToken();
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = this.addDays(
      new Date(),
      AuthConstants.REFRESH_TOKEN_EXPIRES_DAYS,
    );

    await tx.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    const session = await tx.userSession.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt: refreshExpiresAt,
      },
      select: {
        id: true,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      sid: session.id,
      jti: randomUUID(),
    };

    const accessTokenSignOptions: JwtSignOptions = {
      secret: AuthConstants.ACCESS_SECRET,
      expiresIn:
        AuthConstants.ACCESS_TOKEN_EXPIRES_IN as JwtSignOptions['expiresIn'],
    };

    const accessToken = await this.jwtService.signAsync(
      payload,
      accessTokenSignOptions,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: AuthConstants.ACCESS_TOKEN_EXPIRES_IN,
      refreshExpiresAt,
      sessionId: session.id,
    };
  }

  private toSafeUser(user: UserAuthRow) {
    const firstName = this.normalizeNullableString(user.first_name);
    const lastName = this.normalizeNullableString(user.last_name);
    const profileCompleted = Boolean(firstName && lastName);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName,
      lastName,
      avatarUrl: user.avatar_url,
      status: user.status,
      roleId: user.role_id,
      roleName: user.role_name,
      role:
        user.role_id || user.role_name
          ? {
              id: user.role_id,
              name: user.role_name,
            }
          : null,
      permissions: this.normalizePermissions(user.permissions),
      profileCompleted,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  private normalizeIranMobile(value: string): string {
    const digits = this.normalizeDigits(value).replace(/[^\d]/gu, '');

    let normalizedValue = digits;

    if (normalizedValue.startsWith('0098')) {
      normalizedValue = normalizedValue.slice(2);
    }

    if (normalizedValue.startsWith('0')) {
      normalizedValue = `98${normalizedValue.slice(1)}`;
    }

    if (normalizedValue.startsWith('9') && normalizedValue.length === 10) {
      normalizedValue = `98${normalizedValue}`;
    }

    if (!normalizedValue.startsWith('98')) {
      throw new BadRequestException(CUSTOMER_AUTH_MESSAGES.INVALID_PHONE);
    }

    const phone = `+${normalizedValue}`;

    if (!/^\+989\d{9}$/u.test(phone)) {
      throw new BadRequestException(CUSTOMER_AUTH_MESSAGES.INVALID_PHONE);
    }

    return phone;
  }

  private normalizeDigits(value: string): string {
    return normalizePersianArabicDigits(value).trim();
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizePermissions(permissions: string[] | null): string[] {
    if (!Array.isArray(permissions)) {
      return [];
    }

    return Array.from(
      new Set(
        permissions
          .filter(
            (permission): permission is string =>
              typeof permission === 'string' && permission.trim().length > 0,
          )
          .map((permission) => permission.trim()),
      ),
    );
  }

  private shouldExposeDevOtpCode(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    );
  }

  private generateOtpCode(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  private hashOtp(phone: string, code: string): string {
    return createHash('sha256')
      .update(`${phone}:${code}:${AuthConstants.REFRESH_SECRET}`)
      .digest('hex');
  }

  private safeCompareHash(expectedHash: string, actualHash: string): boolean {
    const expected = Buffer.from(expectedHash, 'utf8');
    const actual = Buffer.from(actualHash, 'utf8');

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }

  private generateSecureToken(): string {
    return randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);

    next.setDate(next.getDate() + days);

    return next;
  }

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return typeof value === 'bigint' ? Number(value) : value;
  }
}
