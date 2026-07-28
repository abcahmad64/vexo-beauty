import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type AdminProductRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

type ProductUpdateBody = {
  /* ADMIN_PRODUCT_CLASSIFICATION_PATCH_V1 */

  name?: unknown;
  slug?: unknown;
  sku?: unknown;
  shortDescription?: unknown;
  description?: unknown;

  /* ADMIN_PRODUCT_SEO_PATCH_V1 */

  seoTitle?: unknown;
  seoDescription?: unknown;
  canonicalUrl?: unknown;
  schemaJson?: unknown;

  brandId?: unknown;
  categoryId?: unknown;
  productTypeId?: unknown;
  productModelId?: unknown;

  /* ADMIN_PRODUCT_INVENTORY_PATCH_V1 */

  defaultWarehouseId?: unknown;
  stockQuantity?: unknown;
  lowStockThreshold?: unknown;

  price?: unknown;
  comparePrice?: unknown;
  purchasePrice?: unknown;
  salePrice?: unknown;
};

const moneyPattern = /^\d+(\.\d{1,2})?$/;

function safeProductId(value: string) {
  return encodeURIComponent(value.trim());
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function validateLength(
  value: string | undefined,
  maximum: number,
) {
  return !value || value.length <= maximum;
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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateMoney(value: string | undefined) {
  return !value || moneyPattern.test(value);
}

function optionalNonNegativeInteger(
  value: unknown,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return undefined;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return undefined;
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: AdminProductRouteProps,
) {
  const { productId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/products/${safeProductId(productId)}`,
    timeoutMs: 40_000,
  });
}

export async function PATCH(
  request: Request,
  { params }: AdminProductRouteProps,
) {
  const { productId } = await params;

  let body: ProductUpdateBody;

  try {
    body =
      (await request.json()) as ProductUpdateBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات ویرایش محصول معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const name = optionalString(body.name);
  const slug = optionalString(body.slug);
  const sku = optionalString(body.sku);

  const shortDescription = optionalString(
    body.shortDescription,
  );

  const description = optionalString(
    body.description,
  );

  const seoTitle = nullableString(
    body.seoTitle,
  );

  const seoDescription = nullableString(
    body.seoDescription,
  );

  const canonicalUrl = nullableString(
    body.canonicalUrl,
  );

  let schemaJson:
    | Record<string, unknown>
    | null
    | undefined;

  if (body.schemaJson === null) {
    schemaJson = null;
  } else if (body.schemaJson !== undefined) {
    if (!isRecord(body.schemaJson)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Schema JSON باید یک شیء JSON معتبر باشد.',
          data: null,
        },
        {
          status: 400,
        },
      );
    }

    schemaJson = body.schemaJson;
  }

  const brandId = optionalString(
    body.brandId,
  );

  const categoryId = optionalString(
    body.categoryId,
  );

  const productTypeId = optionalString(
    body.productTypeId,
  );

  const productModelId = optionalString(
    body.productModelId,
  );

  const defaultWarehouseId = optionalString(
    body.defaultWarehouseId,
  );

  const stockQuantity =
    optionalNonNegativeInteger(
      body.stockQuantity,
    );

  const lowStockThreshold =
    optionalNonNegativeInteger(
      body.lowStockThreshold,
    );

  const inventoryFieldsProvided =
    body.defaultWarehouseId !== undefined ||
    body.stockQuantity !== undefined ||
    body.lowStockThreshold !== undefined;

  if (
    inventoryFieldsProvided &&
    !defaultWarehouseId
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'برای ویرایش موجودی، انتخاب انبار الزامی است.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    body.stockQuantity !== undefined &&
    stockQuantity === undefined
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'موجودی باید یک عدد صحیح نامنفی باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    body.lowStockThreshold !== undefined &&
    lowStockThreshold === undefined
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'آستانه کمبود باید یک عدد صحیح نامنفی باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const price = optionalString(body.price);
  const comparePrice = optionalString(
    body.comparePrice,
  );

  const purchasePrice = optionalString(
    body.purchasePrice,
  );

  const salePrice = optionalString(
    body.salePrice,
  );

  if (!validateLength(name, 180)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'نام محصول نباید بیش از ۱۸۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (!validateLength(slug, 220)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'اسلاگ محصول نباید بیش از ۲۲۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (!validateLength(sku, 120)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'SKU محصول نباید بیش از ۱۲۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (!validateLength(shortDescription, 500)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'توضیح کوتاه نباید بیش از ۵۰۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof seoTitle === 'string' &&
    seoTitle.length > 180
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'عنوان SEO نباید بیش از ۱۸۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof seoDescription === 'string' &&
    seoDescription.length > 500
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'توضیحات SEO نباید بیش از ۵۰۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    typeof canonicalUrl === 'string'
  ) {
    let canonical: URL;

    try {
      canonical = new URL(canonicalUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            'Canonical URL معتبر نیست.',
          data: null,
        },
        {
          status: 400,
        },
      );
    }

    if (
      canonical.protocol !== 'http:' &&
      canonical.protocol !== 'https:'
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Canonical URL باید با HTTP یا HTTPS باشد.',
          data: null,
        },
        {
          status: 400,
        },
      );
    }
  }

  const moneyFields = [
    ['قیمت پایه', price],
    ['قیمت مقایسه‌ای', comparePrice],
    ['قیمت خرید', purchasePrice],
    ['قیمت فروش', salePrice],
  ] as const;

  for (const [label, value] of moneyFields) {
    if (!validateMoney(value)) {
      return NextResponse.json(
        {
          success: false,
          message:
            `${label} باید یک عدد مثبت با حداکثر دو رقم اعشار باشد.`,
          data: null,
        },
        {
          status: 400,
        },
      );
    }
  }

  const updateBody = {
    ...(name ? { name } : {}),
    ...(slug ? { slug } : {}),
    ...(sku ? { sku } : {}),
    ...(shortDescription
      ? { shortDescription }
      : {}),
    ...(description ? { description } : {}),
    ...(seoTitle !== undefined
      ? { seoTitle }
      : {}),
    ...(seoDescription !== undefined
      ? { seoDescription }
      : {}),
    ...(canonicalUrl !== undefined
      ? { canonicalUrl }
      : {}),
    ...(schemaJson !== undefined
      ? { schemaJson }
      : {}),
    ...(brandId ? { brandId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(productTypeId
      ? { productTypeId }
      : {}),
    ...(productModelId
      ? { productModelId }
      : {}),
    ...(defaultWarehouseId
      ? { defaultWarehouseId }
      : {}),
    ...(stockQuantity !== undefined
      ? { stockQuantity }
      : {}),
    ...(lowStockThreshold !== undefined
      ? { lowStockThreshold }
      : {}),
    ...(price ? { price } : {}),
    ...(comparePrice ? { comparePrice } : {}),
    ...(purchasePrice ? { purchasePrice } : {}),
    ...(salePrice ? { salePrice } : {}),
  };

  if (Object.keys(updateBody).length === 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          'حداقل یک مقدار معتبر برای ویرایش محصول وارد کنید.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/products/${safeProductId(productId)}`,
    body: updateBody,
    timeoutMs: 40_000,
  });
}
