import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

const allowedQueryParameters = new Set([
  'page',
  'limit',
  'q',
  'productId',
  'sku',
  'barcode',
  'gtin',
  'mpn',
  'isActive',
  'includeDeleted',
  'priceMin',
  'priceMax',
  'createdFrom',
  'createdTo',
  'sortBy',
  'sortDirection',
]);

type CreateVariantBody = {
  productId?: unknown;
  sku?: unknown;
  barcode?: unknown;
  gtin?: unknown;
  mpn?: unknown;
  name?: unknown;
  slug?: unknown;
  price?: unknown;
  comparePrice?: unknown;
  weight?: unknown;
  imageUrl?: unknown;
  isActive?: unknown;
  attributeValueIds?: unknown;
};

const moneyPattern = /^\d+(\.\d{1,2})?$/;
const barcodePattern = /^[A-Za-z0-9._/+:-]+$/;
const gtinPattern =
  /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

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

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const outgoing = new URLSearchParams();

  for (const [key, value] of incoming.searchParams) {
    if (!allowedQueryParameters.has(key)) {
      continue;
    }

    const normalized = value.trim();

    if (normalized) {
      outgoing.set(key, normalized);
    }
  }

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/product-variants${
        query ? `?${query}` : ''
      }`,
    timeoutMs: 40_000,
  });
}

export async function POST(request: Request) {
  let body: CreateVariantBody;

  try {
    body =
      (await request.json()) as CreateVariantBody;
  } catch {
    return errorResponse(
      'اطلاعات ایجاد واریانت معتبر نیست.',
    );
  }

  const productId = optionalString(body.productId);
  const sku = optionalString(body.sku);
  const barcode = optionalString(body.barcode);
  const gtin = optionalString(body.gtin);
  const mpn = optionalString(body.mpn);
  const name = optionalString(body.name);
  const slug = optionalString(body.slug);
  const price = optionalString(body.price);
  const comparePrice = optionalString(
    body.comparePrice,
  );
  const imageUrl = optionalString(body.imageUrl);

  if (!productId) {
    return errorResponse(
      'شناسه محصول برای ایجاد واریانت الزامی است.',
    );
  }

  if (!sku) {
    return errorResponse(
      'SKU واریانت الزامی است.',
    );
  }

  if (sku.length > 120) {
    return errorResponse(
      'SKU واریانت نباید بیش از ۱۲۰ کاراکتر باشد.',
    );
  }

  if (
    barcode &&
    (
      barcode.length > 64 ||
      !barcodePattern.test(barcode)
    )
  ) {
    return errorResponse(
      'بارکد واریانت معتبر نیست.',
    );
  }

  if (gtin && !gtinPattern.test(gtin)) {
    return errorResponse(
      'GTIN باید شامل ۸، ۱۲، ۱۳ یا ۱۴ رقم باشد.',
    );
  }

  if (mpn && mpn.length > 120) {
    return errorResponse(
      'MPN نباید بیش از ۱۲۰ کاراکتر باشد.',
    );
  }

  if (name && name.length > 180) {
    return errorResponse(
      'نام واریانت نباید بیش از ۱۸۰ کاراکتر باشد.',
    );
  }

  if (slug && slug.length > 220) {
    return errorResponse(
      'اسلاگ واریانت نباید بیش از ۲۲۰ کاراکتر باشد.',
    );
  }

  for (const [label, value] of [
    ['قیمت واریانت', price],
    ['قیمت مقایسه‌ای واریانت', comparePrice],
  ] as const) {
    if (value && !moneyPattern.test(value)) {
      return errorResponse(
        `${label} باید عددی نامنفی با حداکثر دو رقم اعشار باشد.`,
      );
    }
  }

  let weight: number | undefined;

  if (
    body.weight !== undefined &&
    body.weight !== null &&
    body.weight !== ''
  ) {
    weight = Number(body.weight);

    if (
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      return errorResponse(
        'وزن واریانت باید یک عدد نامنفی باشد.',
      );
    }
  }

  if (
    body.isActive !== undefined &&
    typeof body.isActive !== 'boolean'
  ) {
    return errorResponse(
      'وضعیت فعال بودن واریانت معتبر نیست.',
    );
  }

  let attributeValueIds: string[] | undefined;

  if (body.attributeValueIds !== undefined) {
    if (
      !Array.isArray(body.attributeValueIds) ||
      body.attributeValueIds.length > 100
    ) {
      return errorResponse(
        'فهرست مقادیر ویژگی‌های واریانت معتبر نیست.',
      );
    }

    attributeValueIds = [];
    const seen = new Set<string>();

    for (const rawValue of body.attributeValueIds) {
      const value = optionalString(rawValue);

      if (!value || seen.has(value)) {
        return errorResponse(
          'شناسه‌های ویژگی واریانت معتبر یا یکتا نیستند.',
        );
      }

      seen.add(value);
      attributeValueIds.push(value);
    }
  }

  return proxyAdminApiRequest({
    method: 'POST',
    pathname: '/admin/product-variants',
    body: {
      productId,
      sku,
      ...(barcode ? { barcode } : {}),
      ...(gtin ? { gtin } : {}),
      ...(mpn ? { mpn } : {}),
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      ...(price ? { price } : {}),
      ...(comparePrice ? { comparePrice } : {}),
      ...(weight !== undefined ? { weight } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(body.isActive !== undefined
        ? { isActive: body.isActive }
        : {}),
      ...(attributeValueIds !== undefined
        ? { attributeValueIds }
        : {}),
    },
    timeoutMs: 40_000,
  });
}
