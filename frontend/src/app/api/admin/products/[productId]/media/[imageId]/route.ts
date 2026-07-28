import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    productId: string;
    imageId: string;
  }>;
};

type UpdateMediaBody = {
  altText?: unknown;
  title?: unknown;
  caption?: unknown;
  isActive?: unknown;
  sortOrder?: unknown;
};

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
  const { productId, imageId } = await params;

  let body: UpdateMediaBody;

  try {
    body = (await request.json()) as UpdateMediaBody;
  } catch {
    return errorResponse(
      'اطلاعات ویرایش رسانه معتبر نیست.',
    );
  }

  const altText = optionalString(body.altText);
  const title = optionalString(body.title);
  const caption = optionalString(body.caption);

  if (altText && altText.length > 180) {
    return errorResponse(
      'متن جایگزین نباید بیش از ۱۸۰ کاراکتر باشد.',
    );
  }

  if (title && title.length > 180) {
    return errorResponse(
      'عنوان رسانه نباید بیش از ۱۸۰ کاراکتر باشد.',
    );
  }

  if (caption && caption.length > 500) {
    return errorResponse(
      'توضیح رسانه نباید بیش از ۵۰۰ کاراکتر باشد.',
    );
  }

  if (
    body.isActive !== undefined &&
    typeof body.isActive !== 'boolean'
  ) {
    return errorResponse(
      'وضعیت فعال بودن رسانه معتبر نیست.',
    );
  }

  let sortOrder: number | undefined;

  if (body.sortOrder !== undefined) {
    const parsed = Number(body.sortOrder);

    if (
      !Number.isInteger(parsed) ||
      parsed < 0
    ) {
      return errorResponse(
        'ترتیب رسانه باید یک عدد صحیح نامنفی باشد.',
      );
    }

    sortOrder = parsed;
  }

  const updateBody = {
    ...(altText ? { altText } : {}),
    ...(title ? { title } : {}),
    ...(caption ? { caption } : {}),
    ...(body.isActive !== undefined
      ? { isActive: body.isActive }
      : {}),
    ...(sortOrder !== undefined
      ? { sortOrder }
      : {}),
  };

  if (Object.keys(updateBody).length === 0) {
    return errorResponse(
      'حداقل یک مقدار معتبر برای ویرایش رسانه وارد کنید.',
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/media/${encodeURIComponent(
        imageId.trim(),
      )}`,
    body: updateBody,
    timeoutMs: 40_000,
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { productId, imageId } = await params;

  return proxyAdminApiRequest({
    method: 'DELETE',
    pathname:
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/media/${encodeURIComponent(
        imageId.trim(),
      )}`,
    timeoutMs: 40_000,
  });
}
