import { NextResponse } from 'next/server';

const apiBase =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000/api'
    : process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api';

type RequestOtpBody = {
  phone?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestOtpBody;

    if (typeof body.phone !== 'string' || !body.phone.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'شماره موبایل را وارد کنید.',
          data: null,
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${apiBase}/auth/customer/request-otp`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: body.phone,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    console.error('[customer-auth] request-otp failed', error);

    return NextResponse.json(
      {
        success: false,
        message: 'ارسال کد تأیید در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      { status: 503 },
    );
  }
}
