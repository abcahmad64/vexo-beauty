import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    variantId: string;
  }>;
};

type PriceBody = {
  price?: unknown;
  comparePrice?: unknown;
  reason?: unknown;
};

const moneyPattern = /^\d+(\.\d{1,2})?$/;

function nullableMoney(
  value: unknown,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || null;
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
      data: null,
    },
    {
      status,
    },
  );
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { variantId } = await params;

  let body: PriceBody;

  try {
    body = (await request.json()) as PriceBody;
  } catch {
    return errorResponse(
      'اطلاعات قیمت واریانت معتبر نیست.',
    );
  }

  const price = nullableMoney(body.price);
  const comparePrice = nullableMoney(
    body.comparePrice,
  );
  const reason = optionalString(body.reason);

  if (
    typeof price === 'string' &&
    !moneyPattern.test(price)
  ) {
    return errorResponse(
      'قیمت واریانت معتبر نیست.',
    );
  }

  if (
    typeof comparePrice === 'string' &&
    !moneyPattern.test(comparePrice)
  ) {
    return errorResponse(
      'قیمت مقایسه‌ای واریانت معتبر نیست.',
    );
  }

  if (
    typeof price === 'string' &&
    typeof comparePrice === 'string' &&
    Number(comparePrice) < Number(price)
  ) {
    return errorResponse(
      'قیمت مقایسه‌ای نباید کمتر از قیمت واریانت باشد.',
    );
  }

  if (reason && reason.length > 500) {
    return errorResponse(
      'توضیح تغییر قیمت نباید بیش از ۵۰۰ کاراکتر باشد.',
    );
  }

  const updateBody = {
    ...(price !== undefined ? { price } : {}),
    ...(comparePrice !== undefined
      ? { comparePrice }
      : {}),
    ...(reason ? { reason } : {}),
  };

  if (
    price === undefined &&
    comparePrice === undefined
  ) {
    return errorResponse(
      'حداقل یکی از قیمت‌ها باید ارسال شود.',
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/product-variants/${encodeURIComponent(
        variantId.trim(),
      )}/price`,
    body: updateBody,
    timeoutMs: 40_000,
  });
}
