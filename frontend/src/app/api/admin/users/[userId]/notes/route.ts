import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type NoteBody = {
  note?: unknown;
  isImportant?: unknown;
  visibility?: unknown;
};

const visibilities = new Set([
  'admin',
  'support',
  'finance',
  'private',
]);

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;
  const incoming = new URL(request.url);
  const limit = Math.min(
    Math.max(
      Number(
        incoming.searchParams.get('limit'),
      ) || 50,
      1,
    ),
    200,
  );

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/notes?limit=${limit}`,
    timeoutMs: 40_000,
  });
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  let body: NoteBody;

  try {
    body = (await request.json()) as NoteBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات یادداشت معتبر نیست.',
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

  const visibility =
    typeof body.visibility === 'string'
      ? body.visibility.trim()
      : 'admin';

  if (!note || note.length > 2000) {
    return NextResponse.json(
      {
        success: false,
        message:
          'متن یادداشت باید بین ۱ تا ۲۰۰۰ کاراکتر باشد.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  if (!visibilities.has(visibility)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'سطح نمایش یادداشت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyAdminApiRequest({
    method: 'POST',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/notes`,
    body: {
      note,
      isImportant:
        body.isImportant === true,
      visibility,
    },
    timeoutMs: 40_000,
  });
}
