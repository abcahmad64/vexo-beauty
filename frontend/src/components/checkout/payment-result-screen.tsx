'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  CircleX,
} from 'lucide-react';
import { useEffect } from 'react';

type PaymentResultScreenProps = {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  status?: string;
};

export function PaymentResultScreen({
  success,
  paymentId,
  orderId,
  status,
}: PaymentResultScreenProps) {
  useEffect(() => {
    if (!success) {
      return;
    }

    window.sessionStorage.removeItem(
      'vexo_checkout_pending_order_id',
    );
    window.sessionStorage.removeItem(
      'vexo_checkout_payment_id',
    );
    window.sessionStorage.removeItem(
      'vexo_checkout_order_number',
    );
  }, [success]);

  return (
    <main className="payment-result-page">
      <section
        className={
          success
            ? 'payment-result is-success'
            : 'payment-result is-failure'
        }
      >
        {success ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <CircleX aria-hidden="true" />
        )}

        <span className="panel-label">
          {success
            ? 'پرداخت موفق'
            : 'پرداخت تکمیل نشد'}
        </span>

        <h1>
          {success
            ? 'سفارش شما با موفقیت پرداخت شد'
            : 'پرداخت ناموفق یا لغوشده بود'}
        </h1>

        <p>
          {success
            ? 'نتیجه پرداخت توسط Backend و درگاه بررسی و ثبت شده است.'
            : 'سفارش شما محفوظ است و می‌توانید وضعیت آن را بررسی یا پرداخت را دوباره پیگیری کنید.'}
        </p>

        <dl>
          {orderId ? (
            <div>
              <dt>شناسه سفارش</dt>
              <dd>
                <bdi dir="ltr">{orderId}</bdi>
              </dd>
            </div>
          ) : null}

          {paymentId ? (
            <div>
              <dt>شناسه پرداخت</dt>
              <dd>
                <bdi dir="ltr">{paymentId}</bdi>
              </dd>
            </div>
          ) : null}

          {status ? (
            <div>
              <dt>وضعیت</dt>
              <dd>
                <bdi dir="ltr">{status}</bdi>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="payment-result__actions">
          {success && orderId ? (
            <Link
              href={`/account/orders/${orderId}`}
              className="button button--primary"
            >
              مشاهدهٔ سفارش
              <ArrowLeft aria-hidden="true" />
            </Link>
          ) : success ? (
            <Link
              href="/account/orders"
              className="button button--primary"
            >
              سفارش‌های من
              <ArrowLeft aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href="/account/orders"
              className="button button--primary"
            >
              بررسی وضعیت سفارش
              <ArrowLeft aria-hidden="true" />
            </Link>
          )}

          <Link href="/products">ادامهٔ خرید</Link>
        </div>
      </section>
    </main>
  );
}
