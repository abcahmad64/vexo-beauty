import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SECURITY_MESSAGES } from '../../../core/security/constants/security.constants';
import { AuthConstants } from '../constants/auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type JwtUserRow = {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly avatar_url: string | null;
  readonly status: string;
  readonly role_id: string | null;
  readonly role_name: string | null;
  readonly permissions: string[] | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: AuthConstants.ACCESS_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const userId = payload.sub?.trim();
    const sessionId = payload.sid?.trim();

    if (!userId || !sessionId) {
      throw new UnauthorizedException(SECURITY_MESSAGES.INVALID_TOKEN);
    }

    const rows = await this.prisma.$queryRaw<JwtUserRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."phone",
          u."firstName" AS first_name,
          u."lastName" AS last_name,
          u."avatarUrl" AS avatar_url,
          u."status"::text AS status,
          u."roleId" AS role_id,
          r."name" AS role_name,
          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT p."name"),
              NULL
            ),
            ARRAY[]::text[]
          ) AS permissions
        FROM "User" u
        INNER JOIN "UserSession" s
          ON s."id" = ${sessionId}
          AND s."userId" = u."id"
          AND s."deleted_at" IS NULL
          AND s."expiresAt" > NOW()
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
          u."firstName",
          u."lastName",
          u."avatarUrl",
          u."status",
          u."roleId",
          r."name"
        LIMIT 1
      `,
    );

    const user = rows[0];

    if (!user) {
      throw new UnauthorizedException(
        SECURITY_MESSAGES.USER_NOT_FOUND_OR_INACTIVE,
      );
    }

    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter(
          (permission): permission is string =>
            typeof permission === 'string' && permission.trim().length > 0,
        )
      : [];

    return {
      id: user.id,
      userId: user.id,
      sub: user.id,
      sessionId,
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
      permissions,
    };
  }
}
