import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

type PaymentStatusBody = {
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  reason?: unknown;
};

const allowedPaymentStatuses = new Set([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUNDED',
]);

const allowedPaymentMethods = new Set([
  'ZARINPAL',
  'IDPAY',
  'CASH',
  'CARD',
  'WALLET',
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
  const { orderId } = await params;

  let body: PaymentStatusBody;

  try {
    body =
      (await request.json()) as PaymentStatusBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات وضعیت پرداخت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const paymentStatus = optionalString(
    body.paymentStatus,
  );

  if (
    !paymentStatus ||
    !allowedPaymentStatuses.has(paymentStatus)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'وضعیت پرداخت معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const paymentMethod = optionalString(
    body.paymentMethod,
  );

  if (
    paymentMethod &&
    !allowedPaymentMethods.has(paymentMethod)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'روش پرداخت معتبر نیست.',
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
        message: 'توضیح تغییر پرداخت بیش از حد طولانی است.',
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
      )}/payment-status`,
    body: {
      paymentStatus,
      ...(paymentMethod
        ? { paymentMethod }
        : {}),
      ...(reason ? { reason } : {}),
    },
    timeoutMs: 40_000,
  });
}
