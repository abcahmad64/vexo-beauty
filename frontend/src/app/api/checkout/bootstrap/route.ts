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

type Envelope<T> = {
  success?: boolean;
  message?: string;
  data?: T | null;
};

export async function GET() {
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
      },
      {
        status: 401,
      },
    );
  }

  try {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const [cartResponse, addressResponse] =
      await Promise.all([
        fetch(`${apiBase}/cart`, {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(25_000),
        }),
        fetch(
          `${apiBase}/addresses?page=1&limit=100`,
          {
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(25_000),
          },
        ),
      ]);

    const cartPayload =
      (await cartResponse.json()) as Envelope<unknown>;

    const addressPayload =
      (await addressResponse.json()) as Envelope<unknown>;

    if (
      cartResponse.status === 401 ||
      addressResponse.status === 401
    ) {
      const result = NextResponse.json(
        {
          success: false,
          message:
            'نشست شما منقضی شده است. دوباره وارد شوید.',
          data: null,
        },
        {
          status: 401,
        },
      );

      result.cookies.delete('vexo_access_token');

      return result;
    }

    if (
      !cartResponse.ok ||
      cartPayload.success !== true
    ) {
      return NextResponse.json(cartPayload, {
        status: cartResponse.status,
      });
    }

    if (
      !addressResponse.ok ||
      addressPayload.success !== true
    ) {
      return NextResponse.json(addressPayload, {
        status: addressResponse.status,
      });
    }

    return NextResponse.json({
      success: true,
      message:
        'اطلاعات مرحلهٔ تسویه‌حساب دریافت شد.',
      data: {
        cart: cartPayload.data,
        addresses: addressPayload.data,
      },
    });
  } catch (error) {
    console.error('[checkout-bootstrap] failed', error);

    return NextResponse.json(
      {
        success: false,
        message:
          'دریافت اطلاعات تسویه‌حساب در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      {
        status: 503,
      },
    );
  }
}
