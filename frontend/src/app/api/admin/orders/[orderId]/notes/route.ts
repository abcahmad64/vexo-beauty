import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type AdminOrderNotesRouteProps = {
  params: Promise<{
    orderId: string;
  }>;
};

type NoteBody = {
  note?: unknown;
  isImportant?: unknown;
  visibility?: unknown;
};

export async function GET(
  request: Request,
  { params }: AdminOrderNotesRouteProps,
) {
  const { orderId } = await params;

  const incomingLimit = Number(
    new URL(request.url).searchParams.get('limit') ?? 50,
  );

  const limit = Number.isFinite(incomingLimit)
    ? Math.min(200, Math.max(1, Math.trunc(incomingLimit)))
    : 50;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/orders/${encodeURIComponent(
        orderId.trim(),
      )}/notes?limit=${limit}`,
    timeoutMs: 40_000,
  });
}

export async function POST(
  request: Request,
  { params }: AdminOrderNotesRouteProps,
) {
  const { orderId } = await params;

  let body: NoteBody;

  try {
    body = (await request.json()) as NoteBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'محتوای یادداشت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const note =
    typeof body.note === 'string'
      ? body.note.trim()
      : '';

  if (!note) {
    return NextResponse.json(
      {
        success: false,
        message: 'متن یادداشت را وارد کنید.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (note.length > 2000) {
    return NextResponse.json(
      {
        success: false,
        message: 'یادداشت نباید بیشتر از ۲۰۰۰ نویسه باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const visibility =
    typeof body.visibility === 'string'
      ? body.visibility.trim()
      : 'admin';

  if (visibility.length > 120) {
    return NextResponse.json(
      {
        success: false,
        message: 'سطح نمایش یادداشت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyAdminApiRequest({
    method: 'POST',
    pathname: `/admin/orders/${encodeURIComponent(
      orderId.trim(),
    )}/notes`,
    body: {
      note,
      isImportant: body.isImportant === true,
      visibility: visibility || 'admin',
    },
    timeoutMs: 40_000,
  });
}
