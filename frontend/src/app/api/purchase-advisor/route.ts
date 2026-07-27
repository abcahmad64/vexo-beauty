import { NextResponse } from 'next/server';

const apiBase =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000/api'
    : process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api';

type AdvisorBody = {
  message?: unknown;
  conversationContext?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdvisorBody;

    if (
      typeof body.message !== 'string' ||
      body.message.trim().length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'لطفاً نیاز یا پرسش خود را دقیق‌تر بنویسید.',
          data: null,
        },
        { status: 400 },
      );
    }

    const response = await fetch(`${apiBase}/ai/public/chat`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: body.message.trim(),
        language: 'fa',
        limit: 5,
        pagePath: '/beauty-assistant',
        conversationContext:
          typeof body.conversationContext === 'string'
            ? body.conversationContext.slice(0, 3000)
            : undefined,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000),
    });

    const payload = await response.json();

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    console.error('[purchase-advisor] request failed', {
      apiBase,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              cause: error.cause,
              stack: error.stack,
            }
          : error,
    });

    return NextResponse.json(
      {
        success: false,
        message: 'دریافت پاسخ مشاوره در حال حاضر امکان‌پذیر نیست.',
        data: null,
      },
      { status: 503 },
    );
  }
}
