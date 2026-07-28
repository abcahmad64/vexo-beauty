import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    couponId: string;
  }>;
};

type StatusBody = {
  status?: unknown;
  reason?: unknown;
};

const statuses = new Set([
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
]);

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { couponId } = await params;

  let body: StatusBody;

  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات وضعیت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const status =
    typeof body.status === 'string'
      ? body.status.trim()
      : '';

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim()
      : '';

  if (!statuses.has(status)) {
    return NextResponse.json(
      {
        success: false,
        message: 'وضعیت کد تخفیف معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (reason.length > 500) {
    return NextResponse.json(
      {
        success: false,
        message:
          'دلیل تغییر وضعیت نباید بیش از ۵۰۰ کاراکتر باشد.',
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
      `/admin/coupons/${encodeURIComponent(
        couponId.trim(),
      )}/status`,
    body: {
      status,
      ...(reason ? { reason } : {}),
    },
    timeoutMs: 40_000,
  });
}
