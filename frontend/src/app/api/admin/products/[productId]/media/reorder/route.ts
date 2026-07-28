import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

type ReorderItemInput = {
  imageId?: unknown;
  sortOrder?: unknown;
};

type ReorderBody = {
  items?: unknown;
};

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
  const { productId } = await params;

  let body: ReorderBody;

  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return errorResponse(
      'اطلاعات مرتب‌سازی رسانه‌ها معتبر نیست.',
    );
  }

  if (!Array.isArray(body.items)) {
    return errorResponse(
      'فهرست رسانه‌ها برای مرتب‌سازی الزامی است.',
    );
  }

  if (
    body.items.length < 1 ||
    body.items.length > 500
  ) {
    return errorResponse(
      'تعداد رسانه‌های مرتب‌سازی باید بین ۱ تا ۵۰۰ مورد باشد.',
    );
  }

  const seenImageIds = new Set<string>();

  const items = [];

  for (const rawItem of body.items) {
    if (
      typeof rawItem !== 'object' ||
      rawItem === null ||
      Array.isArray(rawItem)
    ) {
      return errorResponse(
        'ساختار یکی از رسانه‌های مرتب‌سازی معتبر نیست.',
      );
    }

    const item = rawItem as ReorderItemInput;

    const imageId =
      typeof item.imageId === 'string'
        ? item.imageId.trim()
        : '';

    const sortOrder = Number(item.sortOrder);

    if (!imageId) {
      return errorResponse(
        'شناسه یکی از رسانه‌ها معتبر نیست.',
      );
    }

    if (seenImageIds.has(imageId)) {
      return errorResponse(
        'شناسه تکراری در فهرست رسانه‌ها وجود دارد.',
      );
    }

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return errorResponse(
        'ترتیب هر رسانه باید یک عدد صحیح نامنفی باشد.',
      );
    }

    seenImageIds.add(imageId);

    items.push({
      imageId,
      sortOrder,
    });
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/media/reorder`,
    body: {
      items,
    },
    timeoutMs: 40_000,
  });
}
