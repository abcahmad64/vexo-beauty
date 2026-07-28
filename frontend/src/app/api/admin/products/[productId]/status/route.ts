import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

type StatusBody = {
  status?: unknown;
  isActive?: unknown;
  reason?: unknown;
};

const allowedStatuses = new Set([
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED',
]);

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { productId } = await params;

  let body: StatusBody;

  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات وضعیت محصول معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const status = optionalString(body.status);

  if (!status || !allowedStatuses.has(status)) {
    return NextResponse.json(
      {
        success: false,
        message: 'وضعیت محصول معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (
    body.isActive !== undefined &&
    typeof body.isActive !== 'boolean'
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'وضعیت فعال بودن محصول معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const reason = optionalString(body.reason);

  if (reason && reason.length > 500) {
    return NextResponse.json(
      {
        success: false,
        message: 'توضیح تغییر وضعیت بیش از حد طولانی است.',
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
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/status`,
    body: {
      status,
      ...(body.isActive !== undefined
        ? { isActive: body.isActive }
        : {}),
      ...(reason ? { reason } : {}),
    },
    timeoutMs: 40_000,
  });
}
