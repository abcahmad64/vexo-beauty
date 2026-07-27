'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Box,
  Clock3,
  LoaderCircle,
  PackageCheck,
  PackageOpen,
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
  CustomerOrderCollection,
  ProductMoneyValue,
} from '@/types/storefront';

type StatusPresentation = {
  label: string;
  className: string;
};

function formatMoney(
  value: ProductMoneyValue | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function orderStatus(
  status: string,
): StatusPresentation {
  const value = status.toUpperCase();

  if (
    value === 'DELIVERED' ||
    value === 'COMPLETED'
  ) {
    return {
      label: 'تحویل‌شده',
      className: 'is-success',
    };
  }

  if (value === 'SHIPPED') {
    return {
      label: 'ارسال‌شده',
      className: 'is-shipped',
    };
  }

  if (
    value === 'PROCESSING' ||
    value === 'CONFIRMED' ||
    value === 'PREPARING'
  ) {
    return {
      label: 'در حال آماده‌سازی',
      className: 'is-processing',
    };
  }

  if (value === 'CANCELLED') {
    return {
      label: 'لغوشده',
      className: 'is-failed',
    };
  }

  return {
    label: 'در انتظار پردازش',
    className: 'is-pending',
  };
}

function paymentStatus(
  status: string,
): StatusPresentation {
  const value = status.toUpperCase();

  if (
    value === 'PAID' ||
    value === 'SUCCESS' ||
    value === 'COMPLETED'
  ) {
    return {
      label: 'پرداخت‌شده',
      className: 'is-success',
    };
  }

  if (
    value === 'FAILED' ||
    value === 'CANCELLED'
  ) {
    return {
      label: 'پرداخت ناموفق',
      className: 'is-failed',
    };
  }

  if (value === 'REFUNDED') {
    return {
      label: 'بازگشت وجه',
      className: 'is-refunded',
    };
  }

  return {
    label: 'در انتظار پرداخت',
    className: 'is-pending',
  };
}

function StatusIcon({
  status,
}: {
  status: string;
}) {
  const value = status.toUpperCase();

  if (
    value === 'DELIVERED' ||
    value === 'COMPLETED'
  ) {
    return <PackageCheck aria-hidden="true" />;
  }

  if (value === 'SHIPPED') {
    return <Truck aria-hidden="true" />;
  }

  if (value === 'CANCELLED') {
    return <XCircle aria-hidden="true" />;
  }

  if (
    value === 'PROCESSING' ||
    value === 'CONFIRMED' ||
    value === 'PREPARING'
  ) {
    return <Box aria-hidden="true" />;
  }

  return <Clock3 aria-hidden="true" />;
}

export function OrdersScreen() {
  const [collection, setCollection] =
    useState<CustomerOrderCollection | null>(null);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(
    async (requestedPage: number) => {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/account/orders?page=${requestedPage}&limit=10`,
          {
            cache: 'no-store',
          },
        );

        const payload =
          (await response.json()) as ApiEnvelope<CustomerOrderCollection>;

        if (response.status === 401) {
          setUnauthorized(true);
          setCollection(null);
          return;
        }

        if (
          !response.ok ||
          !payload.success ||
          !payload.data
        ) {
          throw new Error(
            payload.message ||
              'دریافت سفارش‌ها انجام نشد.',
          );
        }

        setUnauthorized(false);
        setCollection(payload.data);
        setPage(requestedPage);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'دریافت سفارش‌ها انجام نشد.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders(1);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOrders]);

  if (loading && !collection) {
    return (
      <main className="orders-page">
        <div className="account-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <p>در حال دریافت سفارش‌های شما...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="orders-page">
        <div className="account-state">
          <ReceiptText aria-hidden="true" />
          <h1>ورود برای مشاهده سفارش‌ها</h1>
          <p>
            برای مشاهده و پیگیری سفارش‌های خود وارد
            حساب کاربری شوید.
          </p>
          <Link
            href="/login?next=%2Faccount%2Forders"
            className="button button--primary"
          >
            ورود به حساب
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  const orders = collection?.data ?? [];

  return (
    <main className="orders-page">
      <nav className="account-breadcrumbs">
        <Link href="/">خانه</Link>
        <ArrowLeft aria-hidden="true" />
        <span>سفارش‌های من</span>
      </nav>

      <header className="account-header">
        <span className="panel-label">
          حساب کاربری
        </span>
        <h1>سفارش‌های من</h1>
        <p>
          وضعیت پرداخت، آماده‌سازی، ارسال و تحویل
          سفارش‌های شما در این بخش نمایش داده می‌شود.
        </p>
      </header>

      {message ? (
        <p className="account-message" role="alert">
          {message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <div className="account-state">
          <PackageOpen aria-hidden="true" />
          <h2>هنوز سفارشی ثبت نشده است</h2>
          <p>
            محصولات فروشگاه را بررسی کنید و نخستین
            سفارش خود را ثبت کنید.
          </p>
          <Link
            href="/products"
            className="button button--primary"
          >
            مشاهدهٔ محصولات
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <section
            className="orders-list"
            aria-label="فهرست سفارش‌ها"
          >
            {orders.map((order: CustomerOrder) => {
              const orderState =
                orderStatus(order.status);
              const paymentState =
                paymentStatus(order.paymentStatus);

              return (
                <article
                  key={order.id}
                  className="order-card"
                >
                  <header className="order-card__header">
                    <div className="order-card__identity">
                      <span className="order-card__icon">
                        <StatusIcon status={order.status} />
                      </span>

                      <div>
                        <span>شماره سفارش</span>
                        <strong>
                          <bdi dir="ltr">
                            {order.orderNumber}
                          </bdi>
                        </strong>
                        <small>
                          {order.createdAtFa ||
                            new Intl.DateTimeFormat(
                              'fa-IR',
                            ).format(
                              new Date(order.createdAt),
                            )}
                        </small>
                      </div>
                    </div>

                    <Link
                      href={`/account/orders/${order.id}`}
                    >
                      مشاهده جزئیات
                      <ArrowLeft aria-hidden="true" />
                    </Link>
                  </header>

                  <div className="order-card__statuses">
                    <span
                      className={`account-status ${orderState.className}`}
                    >
                      {orderState.label}
                    </span>

                    <span
                      className={`account-status ${paymentState.className}`}
                    >
                      {paymentState.label}
                    </span>
                  </div>

                  <dl className="order-card__summary">
                    <div>
                      <dt>مبلغ سفارش</dt>
                      <dd>
                        {formatMoney(
                          order.totalAmount,
                        )}{' '}
                        ریال
                      </dd>
                    </div>

                    <div>
                      <dt>روش پرداخت</dt>
                      <dd>
                        {order.paymentMethod ||
                          'ثبت نشده'}
                      </dd>
                    </div>

                    <div>
                      <dt>روش ارسال</dt>
                      <dd>
                        {order.shippingMethod ||
                          'در حال تعیین'}
                      </dd>
                    </div>
                  </dl>

                  {order.trackingNumber ? (
                    <p className="order-card__tracking">
                      کد رهگیری:{' '}
                      <bdi dir="ltr">
                        {order.trackingNumber}
                      </bdi>
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>

          {collection &&
          collection.meta.totalPages > 1 ? (
            <nav
              className="account-pagination"
              aria-label="صفحه‌بندی سفارش‌ها"
            >
              <button
                type="button"
                disabled={
                  loading ||
                  !collection.meta.hasPrevious
                }
                onClick={() =>
                  void loadOrders(page - 1)
                }
              >
                صفحه قبل
              </button>

              <span>
                صفحه{' '}
                {new Intl.NumberFormat('fa-IR').format(
                  page,
                )}{' '}
                از{' '}
                {new Intl.NumberFormat('fa-IR').format(
                  collection.meta.totalPages,
                )}
              </span>

              <button
                type="button"
                disabled={
                  loading ||
                  !collection.meta.hasNext
                }
                onClick={() =>
                  void loadOrders(page + 1)
                }
              >
                صفحه بعد
              </button>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
