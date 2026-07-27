'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Package,
  ReceiptText,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  ApiEnvelope,
  CustomerOrder,
  CustomerOrderItem,
  ProductMoneyValue,
} from '@/types/storefront';

type OrderDetailScreenProps = {
  orderId: string;
};

function formatMoney(
  value: ProductMoneyValue | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'در انتظار پردازش',
    PENDING_PAYMENT: 'در انتظار پرداخت',
    PROCESSING: 'در حال پردازش',
    CONFIRMED: 'تأییدشده',
    PREPARING: 'در حال آماده‌سازی',
    SHIPPED: 'ارسال‌شده',
    DELIVERED: 'تحویل‌شده',
    COMPLETED: 'تکمیل‌شده',
    CANCELLED: 'لغوشده',
    PAID: 'پرداخت‌شده',
    SUCCESS: 'پرداخت موفق',
    FAILED: 'ناموفق',
    REFUNDED: 'بازگشت وجه',
  };

  return labels[status.toUpperCase()] ?? status;
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'در انتظار پرداخت',
    PROCESSING: 'در حال پردازش پرداخت',
    PAID: 'پرداخت‌شده',
    SUCCESS: 'پرداخت‌شده',
    COMPLETED: 'پرداخت‌شده',
    FAILED: 'پرداخت ناموفق',
    CANCELLED: 'پرداخت لغوشده',
    REFUNDED: 'بازگشت وجه',
  };

  return labels[status.toUpperCase()] ?? status;
}

function progressIndex(status: string) {
  const value = status.toUpperCase();

  if (
    value === 'DELIVERED' ||
    value === 'COMPLETED'
  ) {
    return 4;
  }

  if (value === 'SHIPPED') {
    return 3;
  }

  if (
    value === 'PREPARING' ||
    value === 'PROCESSING' ||
    value === 'CONFIRMED'
  ) {
    return 2;
  }

  if (value === 'CANCELLED') {
    return -1;
  }

  return 1;
}

const progressSteps = [
  {
    label: 'ثبت سفارش',
    icon: ReceiptText,
  },
  {
    label: 'تأیید و آماده‌سازی',
    icon: Package,
  },
  {
    label: 'ارسال سفارش',
    icon: Truck,
  },
  {
    label: 'تحویل سفارش',
    icon: CheckCircle2,
  },
];

export function OrderDetailScreen({
  orderId,
}: OrderDetailScreenProps) {
  const [order, setOrder] =
    useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] =
    useState(false);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(
          orderId,
        )}`,
        {
          cache: 'no-store',
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<CustomerOrder>;

      if (response.status === 401) {
        setUnauthorized(true);
        setOrder(null);
        return;
      }

      if (response.status === 404) {
        setNotFound(true);
        setOrder(null);
        return;
      }

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'دریافت سفارش انجام نشد.',
        );
      }

      setOrder(payload.data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت سفارش انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrder();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOrder]);

  if (loading) {
    return (
      <main className="order-detail-page">
        <div className="account-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <p>در حال دریافت جزئیات سفارش...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="order-detail-page">
        <div className="account-state">
          <ReceiptText aria-hidden="true" />
          <h1>ورود برای مشاهده سفارش</h1>
          <Link
            href={`/login?next=${encodeURIComponent(
              `/account/orders/${orderId}`,
            )}`}
            className="button button--primary"
          >
            ورود به حساب
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  if (notFound || !order) {
    return (
      <main className="order-detail-page">
        <div className="account-state">
          <XCircle aria-hidden="true" />
          <h1>سفارش پیدا نشد</h1>
          <p>
            سفارش در دسترس نیست یا متعلق به این حساب
            کاربری نیست.
          </p>
          <Link
            href="/account/orders"
            className="button button--primary"
          >
            بازگشت به سفارش‌ها
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  const items = order.items ?? [];
  const activeProgress =
    progressIndex(order.status);
  const cancelled =
    activeProgress === -1;

  return (
    <main className="order-detail-page">
      <nav className="account-breadcrumbs">
        <Link href="/">خانه</Link>
        <ArrowLeft aria-hidden="true" />
        <Link href="/account/orders">
          سفارش‌های من
        </Link>
        <ArrowLeft aria-hidden="true" />
        <span>
          <bdi dir="ltr">{order.orderNumber}</bdi>
        </span>
      </nav>

      <header className="order-detail-header">
        <div>
          <span className="panel-label">
            جزئیات سفارش
          </span>
          <h1>
            سفارش{' '}
            <bdi dir="ltr">
              {order.orderNumber}
            </bdi>
          </h1>
          <p>
            ثبت‌شده در{' '}
            {order.createdAtFa ||
              new Intl.DateTimeFormat('fa-IR').format(
                new Date(order.createdAt),
              )}
          </p>
        </div>

        <Link href="/account/orders">
          بازگشت به سفارش‌ها
          <ArrowLeft aria-hidden="true" />
        </Link>
      </header>

      {message ? (
        <p className="account-message" role="alert">
          {message}
        </p>
      ) : null}

      <section
        className={
          cancelled
            ? 'order-progress is-cancelled'
            : 'order-progress'
        }
      >
        {cancelled ? (
          <div className="order-progress__cancelled">
            <XCircle aria-hidden="true" />
            <div>
              <strong>این سفارش لغو شده است</strong>
              <span>
                {order.cancelledAtFa ||
                  'زمان لغو ثبت شده است.'}
              </span>
            </div>
          </div>
        ) : (
          progressSteps.map((step, index) => {
            const StepIcon = step.icon;
            const completed =
              index + 1 <= activeProgress;

            return (
              <div
                key={step.label}
                className={
                  completed
                    ? 'order-progress__step is-complete'
                    : 'order-progress__step'
                }
              >
                <span>
                  <StepIcon aria-hidden="true" />
                </span>
                <strong>{step.label}</strong>
              </div>
            );
          })
        )}
      </section>

      <div className="order-detail-layout">
        <section className="order-detail-main">
          <div className="order-detail-section">
            <span className="panel-label">
              کالاهای سفارش
            </span>
            <h2>اقلام خریداری‌شده</h2>

            <div className="order-detail-items">
              {items.map(
                (item: CustomerOrderItem) => (
                  <article
                    key={item.id}
                    className="order-detail-item"
                  >
                    <span className="order-detail-item__icon">
                      <Package aria-hidden="true" />
                    </span>

                    <div>
                      <strong>
                        {item.productName}
                      </strong>
                      <small>
                        کد کالا:{' '}
                        <bdi dir="ltr">
                          {item.sku}
                        </bdi>
                      </small>
                      <span>
                        تعداد:{' '}
                        {new Intl.NumberFormat(
                          'fa-IR',
                        ).format(item.quantity)}
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>قیمت واحد</dt>
                        <dd>
                          {formatMoney(item.price)} ریال
                        </dd>
                      </div>
                      <div>
                        <dt>جمع</dt>
                        <dd>
                          {formatMoney(
                            item.lineTotal,
                          )}{' '}
                          ریال
                        </dd>
                      </div>
                    </dl>
                  </article>
                ),
              )}
            </div>
          </div>

          <div className="order-detail-section">
            <span className="panel-label">
              ارسال سفارش
            </span>
            <h2>وضعیت ارسال</h2>

            <div className="order-delivery-grid">
              <div>
                <Truck aria-hidden="true" />
                <span>روش ارسال</span>
                <strong>
                  {order.shippingMethod ||
                    'در حال تعیین'}
                </strong>
              </div>

              <div>
                <MapPin aria-hidden="true" />
                <span>کد رهگیری</span>
                <strong>
                  {order.trackingNumber ? (
                    <bdi dir="ltr">
                      {order.trackingNumber}
                    </bdi>
                  ) : (
                    'هنوز ثبت نشده'
                  )}
                </strong>
              </div>

              <div>
                <Clock3 aria-hidden="true" />
                <span>زمان ارسال</span>
                <strong>
                  {order.shippedAtFa ||
                    'هنوز ارسال نشده'}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="order-detail-summary">
          <span className="panel-label">
            خلاصه سفارش
          </span>
          <h2>اطلاعات مالی</h2>

          <dl>
            <div>
              <dt>جمع کالاها</dt>
              <dd>
                {formatMoney(order.subtotal)} ریال
              </dd>
            </div>

            <div>
              <dt>تخفیف</dt>
              <dd>
                {formatMoney(
                  order.discountAmount,
                )}{' '}
                ریال
              </dd>
            </div>

            <div>
              <dt>هزینه ارسال</dt>
              <dd>
                {formatMoney(
                  order.shippingAmount,
                )}{' '}
                ریال
              </dd>
            </div>

            <div>
              <dt>مالیات</dt>
              <dd>
                {formatMoney(order.taxAmount)} ریال
              </dd>
            </div>

            <div className="order-detail-summary__total">
              <dt>مبلغ نهایی</dt>
              <dd>
                {formatMoney(
                  order.totalAmount,
                )}{' '}
                ریال
              </dd>
            </div>
          </dl>

          <div className="order-detail-summary__states">
            <div>
              <span>وضعیت سفارش</span>
              <strong>
                {statusLabel(order.status)}
              </strong>
            </div>

            <div>
              <span>وضعیت پرداخت</span>
              <strong>
                {paymentStatusLabel(
                  order.paymentStatus,
                )}
              </strong>
            </div>

            <div>
              <span>روش پرداخت</span>
              <strong>
                {order.paymentMethod ||
                  'ثبت نشده'}
              </strong>
            </div>
          </div>

          <Link
            href="/products"
            className="button button--primary"
          >
            خرید دوباره
            <ArrowLeft aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
