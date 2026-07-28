import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type CouponBody = {
  code?: unknown;
  type?: unknown;
  value?: unknown;
  description?: unknown;
  minAmount?: unknown;
  usageLimit?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  isActive?: unknown;
  status?: unknown;
};

const allowedParameters = new Set([
  'page',
  'limit',
  'q',
  'couponId',
  'code',
  'type',
  'status',
  'isActive',
  'expired',
  'scheduled',
  'exhausted',
  'hasUsageLimit',
  'includeDeleted',
  'valueMin',
  'valueMax',
  'minAmountMin',
  'minAmountMax',
  'startFrom',
  'startTo',
  'endFrom',
  'endTo',
  'createdFrom',
  'createdTo',
  'sortBy',
  'sortDirection',
]);

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

const moneyPattern = /^\d+(\.\d{1,2})?$/;

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

function requiredString(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean'
    ? value
    : undefined;
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

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const outgoing = new URLSearchParams();

  for (const [key, value] of incoming.searchParams) {
    if (!allowedParameters.has(key)) {
      continue;
    }

    const normalized = value.trim();

    if (normalized) {
      outgoing.set(key, normalized);
    }
  }

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/coupons${query ? `?${query}` : ''}`,
    timeoutMs: 40_000,
  });
}

export async function POST(request: Request) {
  let body: CouponBody;

  try {
    body = (await request.json()) as CouponBody;
  } catch {
    return errorResponse(
      'اطلاعات کد تخفیف معتبر نیست.',
    );
  }

  const code = requiredString(body.code)
    .toUpperCase();

  const type = requiredString(body.type);
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
  const isActive = optionalBoolean(body.isActive);
  const status = optionalString(body.status);

  if (!code || code.length > 80) {
    return errorResponse(
      'کد تخفیف باید بین ۱ تا ۸۰ کاراکتر باشد.',
    );
  }

  if (!couponTypes.has(type)) {
    return errorResponse(
      'نوع کد تخفیف معتبر نیست.',
    );
  }

  if (
    type !== 'FREE_SHIPPING' &&
    (!value || !moneyPattern.test(value))
  ) {
    return errorResponse(
      'مقدار تخفیف معتبر نیست.',
    );
  }

  if (
    type === 'PERCENTAGE' &&
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
      'سقف مصرف باید عددی بین ۱ تا ۱٬۰۰۰٬۰۰۰ باشد.',
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

  if (
    startDate &&
    Number.isNaN(Date.parse(startDate))
  ) {
    return errorResponse(
      'تاریخ شروع معتبر نیست.',
    );
  }

  if (
    endDate &&
    Number.isNaN(Date.parse(endDate))
  ) {
    return errorResponse(
      'تاریخ پایان معتبر نیست.',
    );
  }

  if (
    startDate &&
    endDate &&
    new Date(endDate) < new Date(startDate)
  ) {
    return errorResponse(
      'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.',
    );
  }

  return proxyAdminApiRequest({
    method: 'POST',
    pathname: '/admin/coupons',
    body: {
      code,
      type,
      ...(type !== 'FREE_SHIPPING' && value
        ? { value }
        : {}),
      ...(description ? { description } : {}),
      ...(minAmount ? { minAmount } : {}),
      ...(usageLimit !== undefined
        ? { usageLimit }
        : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(isActive !== undefined
        ? { isActive }
        : {}),
      ...(status ? { status } : {}),
    },
    timeoutMs: 40_000,
  });
}
