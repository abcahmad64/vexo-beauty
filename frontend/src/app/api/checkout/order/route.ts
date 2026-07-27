import { NextResponse } from 'next/server';

import { proxyCustomerApiRequest } from '@/lib/server/customer-api-proxy';

type CheckoutOrderBody = {
  shippingAddressId?: unknown;
};

export async function POST(request: Request) {
  let body: CheckoutOrderBody;

  try {
    body = (await request.json()) as CheckoutOrderBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات ثبت سفارش معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof body.shippingAddressId !== 'string' ||
    body.shippingAddressId.trim().length < 1 ||
    body.shippingAddressId.trim().length > 128
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'برای ثبت سفارش، انتخاب آدرس تحویل الزامی است.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyCustomerApiRequest({
    method: 'POST',
    pathname: '/orders/from-cart',
    timeoutMs: 45_000,
    body: {
      shippingAddressId:
        body.shippingAddressId.trim(),
      useShippingAsBilling: true,
      paymentMethod: 'ZARINPAL',
    },
  });
}
