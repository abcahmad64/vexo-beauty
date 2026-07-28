import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    couponId: string;
  }>;
};

type CouponUpdateBody = {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  description?: unknown;
  minAmount?: unknown;
  usageLimit?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  clearEndDate?: unknown;
  isActive?: unknown;
  status?: unknown;
};

const moneyPattern = /^\d+(\.\d{1,2})?$/;

const couponTypes = new Set([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING',
]);

const couponStatuses = new Set([
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
]);

function safeId(value: string) {
  return encodeURIComponent(value.trim());
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

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function optionalPositiveInteger(value: unknown) {
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
    parsed < 1 ||
    parsed > 1_000_000
  ) {
    return null;
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { couponId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/coupons/${safeId(couponId)}`,
    timeoutMs: 40_000,
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const { couponId } = await params;

  let body: CouponUpdateBody;

  try {
    body =
      (await request.json()) as CouponUpdateBody;
  } catch {
    return errorResponse(
      'اطلاعات ویرایش کد تخفیف معتبر نیست.',
    );
  }

  const code = optionalString(body.code);
  const type = optionalString(body.type);
  const value = optionalString(body.value);
  const description = optionalString(
    body.description,
  );
  const minAmount = optionalString(
    body.minAmount,
  );
  const usageLimit = optionalPositiveInteger(
    body.usageLimit,
  );
  const startDate = optionalString(
    body.startDate,
  );
  const endDate = optionalString(body.endDate);
  const status = optionalString(body.status);

  if (code && code.length > 80) {
    return errorResponse(
      'کد تخفیف نباید بیش از ۸۰ کاراکتر باشد.',
    );
  }

  if (type && !couponTypes.has(type)) {
    return errorResponse(
      'نوع کد تخفیف معتبر نیست.',
    );
  }

  if (value && !moneyPattern.test(value)) {
    return errorResponse(
      'مقدار تخفیف معتبر نیست.',
    );
  }

  if (
    type === 'PERCENTAGE' &&
    value &&
    Number(value) > 100
  ) {
    return errorResponse(
      'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.',
    );
  }

  if (
    minAmount &&
    !moneyPattern.test(minAmount)
  ) {
    return errorResponse(
      'حداقل مبلغ سفارش معتبر نیست.',
    );
  }

  if (usageLimit === null) {
    return errorResponse(
      'سقف مصرف معتبر نیست.',
    );
  }

  if (
    status &&
    !couponStatuses.has(status)
  ) {
    return errorResponse(
      'وضعیت کد تخفیف معتبر نیست.',
    );
  }

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/coupons/${safeId(couponId)}`,
    body: {
      ...(code
        ? { code: code.toUpperCase() }
        : {}),
      ...(type ? { type } : {}),
      ...(value ? { value } : {}),
      ...(description ? { description } : {}),
      ...(minAmount ? { minAmount } : {}),
      ...(usageLimit !== undefined
        ? { usageLimit }
        : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(body.clearEndDate === true
        ? { clearEndDate: true }
        : {}),
      ...(typeof body.isActive === 'boolean'
        ? { isActive: body.isActive }
        : {}),
      ...(status ? { status } : {}),
    },
    timeoutMs: 40_000,
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { couponId } = await params;

  return proxyAdminApiRequest({
    method: 'DELETE',
    pathname:
      `/admin/coupons/${safeId(couponId)}`,
    timeoutMs: 40_000,
  });
}
