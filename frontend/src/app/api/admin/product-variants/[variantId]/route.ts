import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    variantId: string;
  }>;
};

type UpdateVariantBody = {
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

function safeVariantId(value: string) {
  return encodeURIComponent(value.trim());
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

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function nullableString(
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

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { variantId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/product-variants/${safeVariantId(
        variantId,
      )}`,
    timeoutMs: 40_000,
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { variantId } = await params;

  let body: UpdateVariantBody;

  try {
    body =
      (await request.json()) as UpdateVariantBody;
  } catch {
    return errorResponse(
      'اطلاعات ویرایش واریانت معتبر نیست.',
    );
  }

  const sku = optionalString(body.sku);
  const barcode = nullableString(body.barcode);
  const gtin = nullableString(body.gtin);
  const mpn = nullableString(body.mpn);
  const name = optionalString(body.name);
  const slug = optionalString(body.slug);
  const price = optionalString(body.price);
  const comparePrice = optionalString(
    body.comparePrice,
  );
  const imageUrl = optionalString(body.imageUrl);

  if (sku && sku.length > 120) {
    return errorResponse(
      'SKU واریانت نباید بیش از ۱۲۰ کاراکتر باشد.',
    );
  }

  if (
    typeof barcode === 'string' &&
    (
      barcode.length > 64 ||
      !barcodePattern.test(barcode)
    )
  ) {
    return errorResponse(
      'بارکد واریانت معتبر نیست.',
    );
  }

  if (
    typeof gtin === 'string' &&
    !gtinPattern.test(gtin)
  ) {
    return errorResponse(
      'GTIN باید شامل ۸، ۱۲، ۱۳ یا ۱۴ رقم باشد.',
    );
  }

  if (
    typeof mpn === 'string' &&
    mpn.length > 120
  ) {
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
        'فهرست ویژگی‌های واریانت معتبر نیست.',
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

  const updateBody = {
    ...(sku ? { sku } : {}),
    ...(barcode !== undefined ? { barcode } : {}),
    ...(gtin !== undefined ? { gtin } : {}),
    ...(mpn !== undefined ? { mpn } : {}),
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
  };

  if (Object.keys(updateBody).length === 0) {
    return errorResponse(
      'حداقل یک مقدار معتبر برای ویرایش واریانت وارد کنید.',
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/product-variants/${safeVariantId(
        variantId,
      )}`,
    body: updateBody,
    timeoutMs: 40_000,
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { variantId } = await params;

  return proxyAdminApiRequest({
    method: 'DELETE',
    pathname:
      `/admin/product-variants/${safeVariantId(
        variantId,
      )}`,
    timeoutMs: 40_000,
  });
}
