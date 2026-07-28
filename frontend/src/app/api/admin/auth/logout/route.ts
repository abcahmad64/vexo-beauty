import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_SESSION_COOKIE,
  clearAdminCookies,
} from '@/lib/server/admin-api-proxy';

const apiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:4000/api';

export async function POST() {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(
    ADMIN_ACCESS_COOKIE,
  )?.value;

  const refreshToken = cookieStore.get(
    ADMIN_REFRESH_COOKIE,
  )?.value;

  try {
    if (accessToken) {
      await fetch(`${apiBase}/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(refreshToken
            ? {
                refreshToken,
              }
            : {}),
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    }
  } catch (error) {
    console.error('[admin-auth] logout failed', error);
  }

  const result = NextResponse.json({
    success: true,
    message: 'نشست مدیریت بسته شد.',
    data: null,
  });

  clearAdminCookies(result);

  result.cookies.delete(ADMIN_SESSION_COOKIE);

  return result;
}
