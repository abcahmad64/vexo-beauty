import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { Prisma, UserStatus } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AuthConstants } from '../constants/auth.constants';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthEventPublisher } from '../events/auth.event.publisher';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type RequestMeta = {
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
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

const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'ایمیل یا رمز عبور نادرست است.',
  USER_NOT_ACTIVE: 'حساب کاربری فعال نیست.',
  INVALID_REFRESH_TOKEN: 'توکن تازه‌سازی نامعتبر است.',
  USER_NOT_FOUND: 'کاربر یافت نشد.',
  SESSION_NOT_FOUND: 'نشست کاربری یافت نشد.',
  LOGGED_OUT: 'خروج از حساب کاربری با موفقیت انجام شد.',
  SESSION_REVOKED: 'نشست کاربری با موفقیت لغو شد.',
} as const;

const PASSWORD_LOGIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventPublisher: AuthEventPublisher,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.findUserByEmail(email, true);

    if (!user || !user.password || !this.isPasswordLoginRole(user.role_name)) {
      this.publishLoginFailed(email, 'Invalid credentials', meta);

      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.publishLoginFailed(email, `User status is ${user.status}`, meta);

      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_ACTIVE);
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      this.publishLoginFailed(email, 'Invalid credentials', meta);

      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const tokens = await this.issueTokens(user, meta);

    this.eventPublisher.publishUserLoggedIn({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      sessionId: tokens.sessionId,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto, meta: RequestMeta = {}) {
    const oldTokenHash = this.hashToken(dto.refreshToken);
    const rotatedAt = new Date();

    const existing = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: oldTokenHash,
        expiresAt: {
          gt: rotatedAt,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existing) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }

    const user = await this.findUserById(existing.userId);

    const tokens = await this.prisma.$transaction(async (tx) => {
      const consumedToken = await tx.refreshToken.deleteMany({
        where: {
          id: existing.id,
          userId: existing.userId,
          tokenHash: oldTokenHash,
          expiresAt: {
            gt: rotatedAt,
          },
        },
      });

      const revokedSession = await tx.userSession.updateMany({
        where: {
          userId: existing.userId,
          tokenHash: oldTokenHash,
          deletedAt: null,
          expiresAt: {
            gt: rotatedAt,
          },
        },
        data: {
          deletedAt: rotatedAt,
        },
      });

      if (consumedToken.count !== 1 || revokedSession.count !== 1) {
        throw new UnauthorizedException(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
      }

      return this.issueTokensTx(tx, user, meta);
    });

    this.eventPublisher.publishTokenRefreshed({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      sessionId: tokens.sessionId,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  async logout(
    userId: string,
    dto: LogoutDto,
    currentSessionId: string | null,
    meta: RequestMeta = {},
  ) {
    const tokenHash = dto.refreshToken
      ? this.hashToken(dto.refreshToken)
      : null;
    const sessionId = currentSessionId?.trim() || null;

    if (tokenHash || sessionId) {
      await this.prisma.$transaction(async (tx) => {
        const sessionFilters: Prisma.UserSessionWhereInput[] = [];

        if (tokenHash) {
          sessionFilters.push({
            tokenHash,
          });
        }

        if (sessionId) {
          sessionFilters.push({
            id: sessionId,
          });
        }

        const sessions = await tx.userSession.findMany({
          where: {
            userId,
            deletedAt: null,
            OR: sessionFilters,
          },
          select: {
            id: true,
            tokenHash: true,
          },
        });

        if (sessions.length === 0) {
          return;
        }

        const sessionIds = sessions.map((session) => session.id);
        const tokenHashes = Array.from(
          new Set(sessions.map((session) => session.tokenHash)),
        );
        const revokedAt = new Date();

        await tx.userSession.updateMany({
          where: {
            userId,
            id: {
              in: sessionIds,
            },
            deletedAt: null,
          },
          data: {
            deletedAt: revokedAt,
          },
        });

        await tx.refreshToken.deleteMany({
          where: {
            userId,
            tokenHash: {
              in: tokenHashes,
            },
          },
        });
      });
    }

    this.eventPublisher.publishUserLoggedOut({
      userId,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: AUTH_MESSAGES.LOGGED_OUT,
    };
  }

  async logoutAll(userId: string, meta: RequestMeta = {}) {
    const [deletedTokens, updatedSessions] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: {
          userId,
        },
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      }),
    ]);

    this.eventPublisher.publishAllSessionsLoggedOut({
      userId,
      revokedSessionsCount: Math.max(
        deletedTokens.count,
        updatedSessions.count,
      ),
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });

    return {
      success: true,
      revokedTokens: deletedTokens.count,
      revokedSessions: updatedSessions.count,
    };
  }

  async me(userId: string) {
    const user = await this.findUserById(userId);

    return this.toSafeUser(user);
  }

  async listSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        deletedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        userId: true,
        userAgent: true,
        ipAddress: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    meta: RequestMeta = {},
  ) {
    const normalizedSessionId = sessionId.trim();

    if (!normalizedSessionId) {
      throw new BadRequestException(AUTH_MESSAGES.SESSION_NOT_FOUND);
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: normalizedSessionId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        tokenHash: true,
      },
    });

    if (!session) {
      throw new BadRequestException(AUTH_MESSAGES.SESSION_NOT_FOUND);
    }

    await this.prisma.$transaction([
      this.prisma.userSession.update({
        where: {
          id: session.id,
        },
        data: {
          deletedAt: new Date(),
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          tokenHash: session.tokenHash,
        },
      }),
    ]);

    this.eventPublisher.publishSessionRevoked({
      userId,
      sessionId: session.id,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: AUTH_MESSAGES.SESSION_REVOKED,
    };
  }

  async validateUserById(userId: string): Promise<AuthenticatedUser> {
    const user = await this.findUserById(userId);

    return this.toAuthenticatedUser(user);
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
          AND u."status"::text = 'ACTIVE'
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
      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    return rows[0];
  }

  private async findUserByEmail(
    email: string,
    includePassword: boolean,
  ): Promise<UserAuthRow | null> {
    const rows = await this.prisma.$queryRaw<UserAuthRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."phone",
          ${
            includePassword
              ? Prisma.sql`u."password"`
              : Prisma.sql`NULL::text AS "password"`
          },
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
        WHERE LOWER(u."email") = LOWER(${email})
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

  private toSafeUser(user: UserAuthRow) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
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
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  private toAuthenticatedUser(user: UserAuthRow): AuthenticatedUser {
    return {
      id: user.id,
      userId: user.id,
      sub: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
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
    };
  }

  private isPasswordLoginRole(roleName: string | null): boolean {
    if (typeof roleName !== 'string') {
      return false;
    }

    return PASSWORD_LOGIN_ROLES.has(roleName.trim().toUpperCase());
  }

  private publishLoginFailed(
    email: string,
    reason: string,
    meta: RequestMeta,
  ): void {
    this.eventPublisher.publishLoginFailed({
      email,
      reason,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      occurredAt: new Date(),
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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
}
