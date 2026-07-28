import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type SegmentBody = {
  segment?: unknown;
  vipLevel?: unknown;
  tags?: unknown;
  marketingAllowed?: unknown;
  highRisk?: unknown;
  reason?: unknown;
};

const vipLevels = new Set([
  'none',
  'bronze',
  'silver',
  'gold',
  'platinum',
]);

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/segment`,
    timeoutMs: 40_000,
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  let body: SegmentBody;

  try {
    body = (await request.json()) as SegmentBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات سگمنت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const segment =
    typeof body.segment === 'string'
      ? body.segment.trim()
      : '';

  const vipLevel =
    typeof body.vipLevel === 'string'
      ? body.vipLevel.trim()
      : 'none';

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim()
      : '';

  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter(
          (item): item is string =>
            typeof item === 'string',
        )
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];

  if (!vipLevels.has(vipLevel)) {
    return NextResponse.json(
      {
        success: false,
        message: 'سطح VIP معتبر نیست.',
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
          'دلیل تغییر سگمنت نباید بیش از ۵۰۰ کاراکتر باشد.',
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
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/segment`,
    body: {
      ...(segment ? { segment } : {}),
      vipLevel,
      tags,
      ...(typeof body.marketingAllowed ===
      'boolean'
        ? {
            marketingAllowed:
              body.marketingAllowed,
          }
        : {}),
      highRisk: body.highRisk === true,
      ...(reason ? { reason } : {}),
    },
    timeoutMs: 40_000,
  });
}
