import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:4000/api';

export const ADMIN_ACCESS_COOKIE =
  'vexo_admin_access_token';

export const ADMIN_REFRESH_COOKIE =
  'vexo_admin_refresh_token';

export const ADMIN_SESSION_COOKIE =
  'vexo_admin_session_id';

type AdminApiProxyOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  pathname: string;
  body?: unknown;
  timeoutMs?: number;
};

export function clearAdminCookies(
  response: NextResponse,
) {
  response.cookies.delete(ADMIN_ACCESS_COOKIE);
  response.cookies.delete(ADMIN_REFRESH_COOKIE);
  response.cookies.delete(ADMIN_SESSION_COOKIE);
}

export async function proxyAdminApiRequest({
  method,
  pathname,
  body,
  timeoutMs = 30_000,
}: AdminApiProxyOptions) {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(
    ADMIN_ACCESS_COOKIE,
  )?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        message:
          'برای ورود به پنل مدیریت، احراز هویت مدیریتی لازم است.',
        data: null,
        error: {
          statusCode: 401,
          name: 'Unauthorized',
        },
      },
      {
        status: 401,
      },
    );
  }

  try {
    /* ADMIN_API_PROXY_FORM_DATA_V1 */

    const isFormData =
      typeof FormData !== 'undefined' &&
      body instanceof FormData;

    const requestBody =
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body);

    const response = await fetch(
      `${apiBase}${pathname}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined || isFormData
            ? {}
            : {
                'Content-Type': 'application/json',
              }),
        },
        body: requestBody,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    const contentType =
      response.headers.get('content-type') ?? '';

    const payload = contentType.includes(
      'application/json',
    )
      ? await response.json()
      : {
          success: false,
          message:
            'پاسخ معتبری از سرویس مدیریت دریافت نشد.',
          data: null,
        };

    const result = NextResponse.json(payload, {
      status: response.status,
    });

    if (response.status === 401) {
      clearAdminCookies(result);
    }

    return result;
  } catch (error) {
    console.error('[admin-api-proxy] request failed', {
      method,
      pathname,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              cause: error.cause,
            }
          : error,
    });

    return NextResponse.json(
      {
        success: false,
        message:
          'ارتباط با سرویس مدیریت در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      {
        status: 503,
      },
    );
  }
}
