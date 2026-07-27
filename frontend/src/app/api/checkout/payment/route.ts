import { NextResponse } from 'next/server';

import { proxyCustomerApiRequest } from '@/lib/server/customer-api-proxy';

type CheckoutPaymentBody = {
  orderId?: unknown;
};

export async function POST(request: Request) {
  let body: CheckoutPaymentBody;

  try {
    body = (await request.json()) as CheckoutPaymentBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات پرداخت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof body.orderId !== 'string' ||
    body.orderId.trim().length < 1 ||
    body.orderId.trim().length > 128
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'شناسه سفارش معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyCustomerApiRequest({
    method: 'POST',
    pathname: '/payments/gateway/initiate',
    timeoutMs: 60_000,
    body: {
      orderId: body.orderId.trim(),
      paymentMethod: 'ZARINPAL',
    },
  });
}
