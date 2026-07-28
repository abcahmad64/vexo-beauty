import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

const allowedParameters = new Set([
  'categoryId',
  'brandId',
  'productTypeId',
  'productModelId',
]);

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

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const outgoing = new URLSearchParams();

  for (const [key, rawValue] of incoming.searchParams) {
    if (!allowedParameters.has(key)) {
      continue;
    }

    const value = rawValue.trim();

    if (value) {
      outgoing.set(key, value);
    }
  }

  if (!outgoing.get('categoryId')) {
    return errorResponse(
      'شناسه دسته‌بندی برای دریافت ویژگی‌های واریانت الزامی است.',
    );
  }

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/product-catalog/variant-attributes?${query}`,
    timeoutMs: 40_000,
  });
}
