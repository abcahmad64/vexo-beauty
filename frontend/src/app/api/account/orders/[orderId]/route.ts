import { NextResponse } from 'next/server';

import { proxyCustomerApiRequest } from '@/lib/server/customer-api-proxy';

type OrderRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: OrderRouteContext,
) {
  const { orderId } = await context.params;

  if (
    typeof orderId !== 'string' ||
    orderId.trim().length < 1 ||
    orderId.trim().length > 128
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
    method: 'GET',
    pathname: `/orders/my/${encodeURIComponent(
      orderId.trim(),
    )}`,
  });
}
