import { NextResponse } from 'next/server';

import { proxyCartRequest } from '@/lib/server/cart-proxy';

type CartItemRouteProps = {
  params: Promise<{
    cartItemId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: CartItemRouteProps,
) {
  const { cartItemId } = await params;

  let body: {
    quantity?: unknown;
  };

  try {
    body = (await request.json()) as {
      quantity?: unknown;
    };
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'تعداد کالا معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const quantity = Number(body.quantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'تعداد کالا باید یک عدد معتبر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyCartRequest({
    method: 'PATCH',
    pathname: `/cart/items/${encodeURIComponent(
      cartItemId,
    )}`,
    body: {
      quantity,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: CartItemRouteProps,
) {
  const { cartItemId } = await params;

  return proxyCartRequest({
    method: 'DELETE',
    pathname: `/cart/items/${encodeURIComponent(
      cartItemId,
    )}`,
  });
}
