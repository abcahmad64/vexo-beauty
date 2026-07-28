import { NextResponse } from 'next/server';

import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_SESSION_COOKIE,
} from '@/lib/server/admin-api-proxy';

const apiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:4000/api';

type AdminLoginBody = {
  email?: unknown;
  password?: unknown;
};

type AdminUser = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roleName?: string | null;
  role_name?: string | null;
  role?:
    | string
    | {
        id?: string;
        name?: string | null;
      }
    | null;
};

type LoginData = {
  user?: AdminUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string | number;
  refreshExpiresAt?: string;
  sessionId?: string;
  tokenType?: string;
};

type LoginEnvelope = {
  success?: boolean;
  message?: string;
  data?: LoginData | null;
  user?: AdminUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string | number;
  refreshExpiresAt?: string;
  sessionId?: string;
  tokenType?: string;
};

function accessCookieMaxAge(
  expiresIn: string | number | undefined,
) {
  if (
    typeof expiresIn === 'number' &&
    Number.isFinite(expiresIn)
  ) {
    return Math.max(60, Math.floor(expiresIn));
  }

  if (typeof expiresIn === 'string') {
    const match = expiresIn
      .trim()
      .match(/^(\d+)([smhd])$/i);

    if (match) {
      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();

      const multiplier =
        unit === 's'
          ? 1
          : unit === 'm'
            ? 60
            : unit === 'h'
              ? 3600
              : 86400;

      return amount * multiplier;
    }
  }

  return 15 * 60;
}

function roleNameOf(
  user: AdminUser | undefined,
): string | null {
  if (!user) {
    return null;
  }

  const value =
    user.roleName ??
    user.role_name ??
    (typeof user.role === 'string'
      ? user.role
      : user.role?.name);

  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : null;
}

function isAdminRole(roleName: string | null) {
  return (
    roleName === 'ADMIN' ||
    roleName === 'SUPER_ADMIN'
  );
}

export async function POST(request: Request) {
  let body: AdminLoginBody;

  try {
    body = (await request.json()) as AdminLoginBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات ورود معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  const password =
    typeof body.password === 'string'
      ? body.password
      : '';

  if (
    !email ||
    !email.includes('@') ||
    email.length > 180
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'ایمیل مدیریتی معتبر وارد کنید.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (!password || password.length > 120) {
    return NextResponse.json(
      {
        success: false,
        message: 'رمز عبور الزامی است.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const backendResponse = await fetch(
      `${apiBase}/auth/login`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload =
      (await backendResponse.json()) as LoginEnvelope;

    const loginData =
      payload.data &&
      typeof payload.data === 'object'
        ? payload.data
        : {
            user: payload.user,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresIn: payload.expiresIn,
            refreshExpiresAt:
              payload.refreshExpiresAt,
            sessionId: payload.sessionId,
            tokenType: payload.tokenType,
          };

    if (
      !backendResponse.ok ||
      payload.success === false
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            payload.message ||
            'ایمیل یا رمز عبور نادرست است.',
          data: null,
        },
        {
          status: backendResponse.status,
        },
      );
    }

    const roleName = roleNameOf(loginData.user);

    if (
      !loginData.accessToken ||
      !loginData.refreshToken ||
      !isAdminRole(roleName)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'این حساب دسترسی معتبر مدیریت ندارد.',
          data: null,
        },
        {
          status: 403,
        },
      );
    }

    const result = NextResponse.json(
      {
        success: true,
        message:
          payload.message ||
          'ورود مدیریتی با موفقیت انجام شد.',
        data: {
          user: loginData.user,
          roleName,
          sessionId: loginData.sessionId ?? null,
          tokenType: loginData.tokenType ?? 'Bearer',
        },
      },
      {
        status: 200,
      },
    );

    const requestUrl = new URL(request.url);

    const forwardedProto = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
      .toLowerCase();

    const effectiveProtocol =
      forwardedProto === 'https' ||
      forwardedProto === 'http'
        ? `${forwardedProto}:`
        : requestUrl.protocol;

    const secure = effectiveProtocol === 'https:';

    result.cookies.set({
      name: ADMIN_ACCESS_COOKIE,
      value: loginData.accessToken,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: accessCookieMaxAge(
        loginData.expiresIn,
      ),
    });

    const refreshExpiry =
      loginData.refreshExpiresAt
        ? new Date(loginData.refreshExpiresAt)
        : undefined;

    result.cookies.set({
      name: ADMIN_REFRESH_COOKIE,
      value: loginData.refreshToken,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      expires:
        refreshExpiry &&
        !Number.isNaN(refreshExpiry.getTime())
          ? refreshExpiry
          : undefined,
      maxAge: refreshExpiry
        ? undefined
        : 30 * 24 * 60 * 60,
    });

    if (loginData.sessionId) {
      result.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: loginData.sessionId,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshExpiry
          ? undefined
          : 30 * 24 * 60 * 60,
        expires:
          refreshExpiry &&
          !Number.isNaN(refreshExpiry.getTime())
            ? refreshExpiry
            : undefined,
      });
    }

    return result;
  } catch (error) {
    console.error('[admin-auth] login failed', error);

    return NextResponse.json(
      {
        success: false,
        message:
          'ارتباط با سرویس ورود مدیریت امکان‌پذیر نیست.',
        data: null,
      },
      {
        status: 503,
      },
    );
  }
}
