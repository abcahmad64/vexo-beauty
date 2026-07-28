import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

type StatusBody = {
  status?: unknown;
  trackingNumber?: unknown;
  shippedAt?: unknown;
  deliveredAt?: unknown;
  reason?: unknown;
};

const allowedStatuses = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function optionalDateString(value: unknown) {
  const normalized = optionalString(value);

  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { orderId } = await params;

  let body: StatusBody;

  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات وضعیت سفارش معتبر نیست.',
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
        message: 'وضعیت سفارش معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const trackingNumber = optionalString(
    body.trackingNumber,
  );

  const reason = optionalString(body.reason);

  if (trackingNumber && trackingNumber.length > 180) {
    return NextResponse.json(
      {
        success: false,
        message: 'کد رهگیری بیش از حد طولانی است.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

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

  const shippedAt = optionalDateString(body.shippedAt);
  const deliveredAt = optionalDateString(
    body.deliveredAt,
  );

  if (shippedAt === null || deliveredAt === null) {
    return NextResponse.json(
      {
        success: false,
        message: 'تاریخ ارسال یا تحویل معتبر نیست.',
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
      `/admin/orders/${encodeURIComponent(
        orderId.trim(),
      )}/status`,
    body: {
      status,
      ...(trackingNumber
        ? { trackingNumber }
        : {}),
      ...(shippedAt ? { shippedAt } : {}),
      ...(deliveredAt
        ? { deliveredAt }
        : {}),
      ...(reason ? { reason } : {}),
    },
    timeoutMs: 40_000,
  });
}
