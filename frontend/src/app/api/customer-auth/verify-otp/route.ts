import { NextResponse } from 'next/server';

const apiBase =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000/api'
    : process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api';

type VerifyOtpBody = {
  phone?: unknown;
  code?: unknown;
};

type VerifyPayload = {
  success?: boolean;
  message?: string;
  data?: {
    user?: unknown;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: string | number;
    refreshExpiresAt?: string;
    sessionId?: string;
    tokenType?: string;
  } | null;
};

function accessCookieMaxAge(expiresIn: string | number | undefined) {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    return Math.max(60, Math.floor(expiresIn));
  }

  if (typeof expiresIn === 'string') {
    const match = expiresIn.trim().match(/^(\d+)([smhd])$/i);

    if (match) {
      const value = Number(match[1]);
      const unit = match[2].toLowerCase();

      const multiplier =
        unit === 's'
          ? 1
          : unit === 'm'
            ? 60
            : unit === 'h'
              ? 3600
              : 86400;

      return value * multiplier;
    }
  }

  return 15 * 60;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyOtpBody;

    if (
      typeof body.phone !== 'string' ||
      typeof body.code !== 'string' ||
      !body.phone.trim() ||
      !body.code.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'شماره موبایل و کد تأیید الزامی هستند.',
          data: null,
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${apiBase}/auth/customer/verify-otp`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: body.phone,
          code: body.code,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = (await response.json()) as VerifyPayload;
    const result = NextResponse.json(
      {
        ...payload,
        data: payload.data
          ? {
              user: payload.data.user,
              sessionId: payload.data.sessionId,
              tokenType: payload.data.tokenType,
            }
          : null,
      },
      {
        status: response.status,
      },
    );

    if (
      response.ok &&
      payload.success &&
      payload.data?.accessToken &&
      payload.data.refreshToken
    ) {
      const secure = process.env.NODE_ENV === 'production';

      result.cookies.set({
        name: 'vexo_access_token',
        value: payload.data.accessToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessCookieMaxAge(payload.data.expiresIn),
      });

      const refreshExpiry = payload.data.refreshExpiresAt
        ? new Date(payload.data.refreshExpiresAt)
        : undefined;

      result.cookies.set({
        name: 'vexo_refresh_token',
        value: payload.data.refreshToken,
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        expires:
          refreshExpiry && !Number.isNaN(refreshExpiry.getTime())
            ? refreshExpiry
            : undefined,
        maxAge: refreshExpiry ? undefined : 30 * 24 * 60 * 60,
      });
    }

    return result;
  } catch (error) {
    console.error('[customer-auth] verify-otp failed', error);

    return NextResponse.json(
      {
        success: false,
        message: 'بررسی کد تأیید در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      { status: 503 },
    );
  }
}
