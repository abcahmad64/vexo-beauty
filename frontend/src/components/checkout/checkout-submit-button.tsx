'use client';

import {
  ArrowLeft,
  LoaderCircle,
  RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T | null;
};

type CreatedOrder = {
  id?: string;
  orderId?: string;
  orderNumber?: string;
};

type PaymentInitiation = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  provider: 'zarinpal';
  authority: string;
  paymentUrl: string;
  amount: string;
  currency: string;
};

type CheckoutSubmitButtonProps = {
  selectedAddressId: string | null;
};

const pendingOrderKey =
  'vexo_checkout_pending_order_id';

function resolveOrderId(order: CreatedOrder): string | null {
  const value = order.id ?? order.orderId;

  return typeof value === 'string' &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

function assertSafePaymentUrl(value: string): string {
  const url = new URL(value);

  const hostname = url.hostname.toLowerCase();

  const isZarinpal =
    hostname === 'zarinpal.com' ||
    hostname.endsWith('.zarinpal.com');

  if (url.protocol !== 'https:' || !isZarinpal) {
    throw new Error(
      'آدرس انتقال به درگاه پرداخت معتبر نیست.',
    );
  }

  return url.toString();
}

export function CheckoutSubmitButton({
  selectedAddressId,
}: CheckoutSubmitButtonProps) {
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<
    'idle' | 'order' | 'payment' | 'redirect'
  >('idle');
  const [error, setError] =
    useState<string | null>(null);

  async function createOrder(): Promise<string> {
    const response = await fetch(
      '/api/checkout/order',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingAddressId: selectedAddressId,
        }),
      },
    );

    const payload =
      (await response.json()) as ApiEnvelope<CreatedOrder>;

    if (
      !response.ok ||
      payload.success !== true ||
      !payload.data
    ) {
      throw new Error(
        payload.message ||
          'ثبت سفارش انجام نشد.',
      );
    }

    const orderId = resolveOrderId(payload.data);

    if (!orderId) {
      throw new Error(
        'سفارش ایجاد شد، اما شناسه معتبر دریافت نشد.',
      );
    }

    window.sessionStorage.setItem(
      pendingOrderKey,
      orderId,
    );

    return orderId;
  }

  async function initiatePayment(
    orderId: string,
  ): Promise<PaymentInitiation> {
    const response = await fetch(
      '/api/checkout/payment',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
        }),
      },
    );

    const payload =
      (await response.json()) as ApiEnvelope<PaymentInitiation>;

    if (
      !response.ok ||
      payload.success !== true ||
      !payload.data
    ) {
      throw new Error(
        payload.message ||
          'آغاز پرداخت انجام نشد.',
      );
    }

    return payload.data;
  }

  async function submitCheckout() {
    if (!selectedAddressId || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const savedOrderId =
        window.sessionStorage.getItem(
          pendingOrderKey,
        );

      let orderId =
        savedOrderId &&
        savedOrderId.trim().length > 0
          ? savedOrderId.trim()
          : null;

      if (!orderId) {
        setStage('order');
        orderId = await createOrder();
      }

      setStage('payment');

      const payment =
        await initiatePayment(orderId);

      window.sessionStorage.setItem(
        'vexo_checkout_payment_id',
        payment.paymentId,
      );

      window.sessionStorage.setItem(
        'vexo_checkout_order_number',
        payment.orderNumber,
      );

      setStage('redirect');

      const paymentUrl =
        assertSafePaymentUrl(payment.paymentUrl);

      window.location.assign(paymentUrl);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'ادامه فرایند پرداخت انجام نشد.',
      );

      setStage('idle');
      setPending(false);
    }
  }

  const label =
    stage === 'order'
      ? 'در حال ثبت سفارش...'
      : stage === 'payment'
        ? 'در حال آماده‌سازی پرداخت...'
        : stage === 'redirect'
          ? 'در حال انتقال به درگاه...'
          : error
            ? 'تلاش دوباره برای پرداخت'
            : 'ثبت سفارش و پرداخت';

  return (
    <div className="checkout-submit">
      <button
        type="button"
        className="button button--primary"
        disabled={!selectedAddressId || pending}
        onClick={submitCheckout}
      >
        {pending ? (
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
        ) : error ? (
          <RefreshCcw aria-hidden="true" />
        ) : (
          <ArrowLeft aria-hidden="true" />
        )}

        {label}
      </button>

      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <small>
          مبلغ، موجودی و وضعیت سفارش توسط سامانه
          دوباره بررسی می‌شود.
        </small>
      )}
    </div>
  );
}
