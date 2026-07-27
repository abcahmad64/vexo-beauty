import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000/api'
    : process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api';

type CustomerApiProxyOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  pathname: string;
  body?: unknown;
  timeoutMs?: number;
};

export async function proxyCustomerApiRequest({
  method,
  pathname,
  body,
  timeoutMs = 25_000,
}: CustomerApiProxyOptions) {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(
    'vexo_access_token',
  )?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        message:
          'برای ادامه فرایند خرید ابتدا وارد حساب کاربری شوید.',
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
    const response = await fetch(
      `${apiBase}${pathname}`,
      {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
              }),
        },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
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
            'پاسخ معتبری از سرویس فروشگاه دریافت نشد.',
          data: null,
        };

    const result = NextResponse.json(payload, {
      status: response.status,
    });

    if (response.status === 401) {
      result.cookies.delete('vexo_access_token');
    }

    return result;
  } catch (error) {
    console.error('[customer-api-proxy] request failed', {
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
          'ارتباط با سرویس فروشگاه در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      {
        status: 503,
      },
    );
  }
}
