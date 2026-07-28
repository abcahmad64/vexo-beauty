import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type UpdateBody = {
  email?: unknown;
  phone?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  avatarUrl?: unknown;
  roleId?: unknown;
};

function safeId(value: string) {
  return encodeURIComponent(value.trim());
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function errorResponse(message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      data: null,
    },
    {
      status: 400,
    },
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/users/${safeId(userId)}`,
    timeoutMs: 40_000,
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  let body: UpdateBody;

  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return errorResponse(
      'اطلاعات مشتری معتبر نیست.',
    );
  }

  const email = optionalString(body.email);
  const phone = optionalString(body.phone);
  const firstName = optionalString(
    body.firstName,
  );
  const lastName = optionalString(
    body.lastName,
  );
  const avatarUrl = optionalString(
    body.avatarUrl,
  );
  const roleId = optionalString(body.roleId);

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return errorResponse(
      'ایمیل مشتری معتبر نیست.',
    );
  }

  if (
    phone &&
    !/^(?:\+98|0098|98|0)?9\d{9}$/.test(
      phone.replace(/[\s\-()]/g, ''),
    )
  ) {
    return errorResponse(
      'شماره موبایل مشتری معتبر نیست.',
    );
  }

  const updateBody = {
    ...(email
      ? { email: email.toLowerCase() }
      : {}),
    ...(phone ? { phone } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(roleId ? { roleId } : {}),
  };

  if (Object.keys(updateBody).length === 0) {
    return errorResponse(
      'حداقل یک فیلد برای ویرایش ارسال شود.',
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/users/${safeId(userId)}`,
    body: updateBody,
    timeoutMs: 40_000,
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  return proxyAdminApiRequest({
    method: 'DELETE',
    pathname:
      `/admin/users/${safeId(userId)}`,
    timeoutMs: 40_000,
  });
}
