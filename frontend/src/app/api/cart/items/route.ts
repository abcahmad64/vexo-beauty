import { NextResponse } from 'next/server';

import { proxyCartRequest } from '@/lib/server/cart-proxy';

type AddItemBody = {
  productId?: unknown;
  variantId?: unknown;
  quantity?: unknown;
};

export async function POST(request: Request) {
  let body: AddItemBody;

  try {
    body = (await request.json()) as AddItemBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات کالا معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof body.productId !== 'string' ||
    !body.productId.trim()
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'شناسهٔ محصول الزامی است.',
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
        message: 'تعداد انتخاب‌شده معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyCartRequest({
    method: 'POST',
    pathname: '/cart/items',
    body: {
      productId: body.productId.trim(),
      quantity,
      ...(typeof body.variantId === 'string' &&
      body.variantId.trim()
        ? {
            variantId: body.variantId.trim(),
          }
        : {}),
    },
  });
}
