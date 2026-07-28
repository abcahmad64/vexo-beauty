'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AdminHeader } from '@/components/admin/admin-header';

import type {
  AdminApiEnvelope,
  AdminOrderListItem,
  AdminOrderListMeta,
} from '@/types/admin';

type OrdersPayload =
  | {
      items?: AdminOrderListItem[];
      orders?: AdminOrderListItem[];
      data?: AdminOrderListItem[];
      meta?: Partial<AdminOrderListMeta>;
      pagination?: Partial<AdminOrderListMeta>;
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
    }
  | AdminOrderListItem[];

const orderStatuses = [
  ['', 'همه وضعیت‌ها'],
  ['PENDING', 'در انتظار بررسی'],
  ['CONFIRMED', 'تأییدشده'],
  ['PROCESSING', 'در حال آماده‌سازی'],
  ['SHIPPED', 'ارسال‌شده'],
  ['DELIVERED', 'تحویل‌شده'],
  ['CANCELLED', 'لغوشده'],
  ['REFUNDED', 'مرجوع‌شده'],
] as const;

const paymentStatuses = [
  ['', 'همه پرداخت‌ها'],
  ['PENDING', 'در انتظار پرداخت'],
  ['COMPLETED', 'پرداخت‌شده'],
  ['FAILED', 'ناموفق'],
  ['REFUNDED', 'بازپرداخت‌شده'],
  ['PARTIAL_REFUNDED', 'بازپرداخت جزئی'],
] as const;

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  CONFIRMED: 'تأییدشده',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  REFUNDED: 'مرجوع‌شده',
};

const paymentLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  COMPLETED: 'پرداخت‌شده',
  FAILED: 'ناموفق',
  REFUNDED: 'بازپرداخت‌شده',
  PARTIAL_REFUNDED: 'بازپرداخت جزئی',
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
  fallback = '',
) {
  return typeof value === 'string'
    ? value
    : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === 'string'
    ? value
    : null;
}

function readMoneyValue(
  value: unknown,
  fallback: string | number = 0,
): string | number {
  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return value;
  }

  return fallback;
}

function normalizeOrder(
  value: unknown,
): AdminOrderListItem {
  const order = isRecord(value) ? value : {};
  const user = isRecord(order.user)
    ? order.user
    : {};
  const amounts = isRecord(order.amounts)
    ? order.amounts
    : {};
  const payment = isRecord(order.payment)
    ? order.payment
    : {};
  const shipping = isRecord(order.shipping)
    ? order.shipping
    : {};
  const invoice = isRecord(order.invoice)
    ? order.invoice
    : {};
  const itemsSummary = isRecord(
    order.itemsSummary,
  )
    ? order.itemsSummary
    : {};

  return {
    id: readString(order.id),
    userId:
      readNullableString(order.userId) ??
      readNullableString(user.id),
    orderNumber: readString(
      order.orderNumber,
      '—',
    ),
    status: readString(
      order.status,
      'PENDING',
    ),
    paymentStatus: readString(
      order.paymentStatus ??
        payment.status,
      'PENDING',
    ),
    paymentMethod:
      readNullableString(
        order.paymentMethod,
      ) ??
      readNullableString(payment.method),
    totalAmount: readMoneyValue(
      order.totalAmount ??
        amounts.totalAmount,
      0,
    ),
    paidAmount:
      order.paidAmount === null ||
      amounts.paidAmount === null
        ? null
        : readMoneyValue(
            order.paidAmount ??
              amounts.paidAmount,
            0,
          ),
    currency:
      readNullableString(order.currency) ??
      readNullableString(amounts.currency),
    itemCount: readNumber(
      order.itemCount ??
        itemsSummary.itemCount,
      0,
    ),
    totalQuantity: readNumber(
      order.totalQuantity ??
        itemsSummary.totalQuantity,
      0,
    ),
    userEmail:
      readNullableString(order.userEmail) ??
      readNullableString(user.email),
    userPhone:
      readNullableString(order.userPhone) ??
      readNullableString(user.phone),
    userFirstName:
      readNullableString(
        order.userFirstName,
      ) ??
      readNullableString(user.firstName),
    userLastName:
      readNullableString(
        order.userLastName,
      ) ??
      readNullableString(user.lastName),
    shippingMethod:
      readNullableString(
        order.shippingMethod,
      ) ??
      readNullableString(shipping.method),
    trackingNumber:
      readNullableString(
        order.trackingNumber,
      ) ??
      readNullableString(
        shipping.trackingNumber,
      ),
    invoiceStatus:
      readNullableString(
        order.invoiceStatus,
      ) ??
      readNullableString(invoice.status),
    createdAt: readNullableString(
      order.createdAt,
    ),
    updatedAt: readNullableString(
      order.updatedAt,
    ),
    deletedAt: readNullableString(
      order.deletedAt,
    ),
  };
}

function readNumber(
  value: unknown,
  fallback: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function parsePayload(
  payload: OrdersPayload,
  requestedPage: number,
  requestedLimit: number,
): {
  orders: AdminOrderListItem[];
  meta: AdminOrderListMeta;
} {
  if (Array.isArray(payload)) {
    const orders = payload.map(
      normalizeOrder,
    );

    return {
      orders,
      meta: {
        page: requestedPage,
        limit: requestedLimit,
        total: orders.length,
        totalPages: Math.max(
          1,
          Math.ceil(
            orders.length / requestedLimit,
          ),
        ),
      },
    };
  }

  const orders = (
    payload.items ??
    payload.orders ??
    payload.data ??
    []
  ).map(normalizeOrder);

  const metadata =
    payload.meta ??
    payload.pagination ??
    {};

  const page = readNumber(
    metadata.page ?? payload.page,
    requestedPage,
  );

  const limit = readNumber(
    metadata.limit ?? payload.limit,
    requestedLimit,
  );

  const total = readNumber(
    metadata.total ?? payload.total,
    orders.length,
  );

  const totalPages = readNumber(
    metadata.totalPages ?? payload.totalPages,
    Math.max(1, Math.ceil(total / limit)),
  );

  return {
    orders,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

function formatMoney(
  value: string | number | null | undefined,
) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function customerName(order: AdminOrderListItem) {
  const name = [
    order.userFirstName,
    order.userLastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    name ||
    order.userEmail ||
    order.userPhone ||
    'مشتری ثبت‌شده'
  );
}

export function AdminOrdersScreen() {
  const [orders, setOrders] = useState<
    AdminOrderListItem[]
  >([]);

  const [meta, setMeta] =
    useState<AdminOrderListMeta>({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] =
    useState('');

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      });

      if (submittedQuery) {
        params.set('q', submittedQuery);
      }

      if (status) {
        params.set('status', status);
      }

      if (paymentStatus) {
        params.set(
          'paymentStatus',
          paymentStatus,
        );
      }

      const response = await fetch(
        `/api/admin/orders?${params.toString()}`,
        {
          cache: 'no-store',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<OrdersPayload>;

      if (response.status === 401) {
        window.location.href =
          '/admin/login?next=%2Fadmin%2Forders';
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true ||
        envelope.data === null
      ) {
        throw new Error(
          envelope.message ||
            'دریافت سفارش‌ها انجام نشد.',
        );
      }

      const parsed = parsePayload(
        envelope.data,
        page,
        20,
      );

      setOrders(parsed.orders);
      setMeta(parsed.meta);
    } catch (error) {
      setOrders([]);
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت سفارش‌ها انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    paymentStatus,
    status,
    submittedQuery,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadOrders]);

  const metrics = useMemo(() => {
    const paid = orders.filter(
      (order) =>
        order.paymentStatus === 'COMPLETED',
    ).length;

    const processing = orders.filter(
      (order) =>
        order.status === 'PROCESSING' ||
        order.status === 'CONFIRMED',
    ).length;

    const shipping = orders.filter(
      (order) => order.status === 'SHIPPED',
    ).length;

    return [
      {
        label: 'کل نتایج',
        value: meta.total,
        icon: ClipboardList,
      },
      {
        label: 'پرداخت‌شده در صفحه',
        value: paid,
        icon: CircleDollarSign,
      },
      {
        label: 'در حال پردازش',
        value: processing,
        icon: PackageCheck,
      },
      {
        label: 'در مسیر ارسال',
        value: shipping,
        icon: Truck,
      },
    ];
  }, [meta.total, orders]);

  function submitSearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  function resetFilters() {
    setQuery('');
    setSubmittedQuery('');
    setStatus('');
    setPaymentStatus('');
    setPage(1);
  }

  return (
    <main className="admin-page">
      <AdminHeader
        title="مدیریت سفارش‌ها"
        subtitle="بررسی سفارش، پرداخت، مشتری و وضعیت آماده‌سازی"
        onRefresh={loadOrders}
        refreshing={loading}
      />

      <section className="admin-order-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.label}>
              <span>
                <Icon aria-hidden="true" />
              </span>

              <div>
                <small>{metric.label}</small>
                <strong>
                  {new Intl.NumberFormat(
                    'fa-IR',
                  ).format(metric.value)}
                </strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-orders-toolbar">
        <form onSubmit={submitSearch}>
          <div className="admin-orders-search">
            <Search aria-hidden="true" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="شماره سفارش، ایمیل، موبایل یا کد رهگیری"
            />

            <button
              type="submit"
              disabled={loading}
            >
              جستجو
            </button>
          </div>
        </form>

        <div className="admin-orders-filters">
          <SlidersHorizontal
            aria-hidden="true"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {orderStatuses.map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(
                event.target.value,
              );
              setPage(1);
            }}
          >
            {paymentStatuses.map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
          >
            پاک‌کردن فیلترها
          </button>
        </div>
      </section>

      {message ? (
        <p
          className="admin-message"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <section className="admin-orders-panel">
        <header>
          <div>
            <span className="panel-label">
              ORDERS
            </span>
            <h2>فهرست سفارش‌ها</h2>
          </div>

          <span>
            صفحه{' '}
            {new Intl.NumberFormat(
              'fa-IR',
            ).format(meta.page)}
            {' '}از{' '}
            {new Intl.NumberFormat(
              'fa-IR',
            ).format(meta.totalPages)}
          </span>
        </header>

        {loading && orders.length === 0 ? (
          <div className="admin-orders-state">
            <LoaderCircle
              className="is-spinning"
              aria-hidden="true"
            />
            <p>در حال دریافت سفارش‌ها...</p>
          </div>
        ) : null}

        {!loading && orders.length === 0 ? (
          <div className="admin-orders-state">
            <ClipboardList aria-hidden="true" />
            <h3>سفارشی یافت نشد</h3>
            <p>
              عبارت جستجو یا فیلترهای انتخاب‌شده را
              تغییر دهید.
            </p>
          </div>
        ) : null}

        {orders.length > 0 ? (
          <div className="admin-orders-table-wrap">
            <table className="admin-orders-table">
              <thead>
                <tr>
                  <th>سفارش</th>
                  <th>مشتری</th>
                  <th>مبلغ</th>
                  <th>وضعیت سفارش</th>
                  <th>پرداخت</th>
                  <th>اقلام</th>
                  <th>تاریخ ثبت</th>
                  <th aria-label="عملیات" />
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="admin-order-primary">
                        <strong dir="ltr">
                          {order.orderNumber}
                        </strong>

                        {order.trackingNumber ? (
                          <small dir="ltr">
                            رهگیری:{' '}
                            {order.trackingNumber}
                          </small>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <div className="admin-order-customer">
                        <span>
                          <UserRound
                            aria-hidden="true"
                          />
                        </span>

                        <div>
                          <strong>
                            {customerName(order)}
                          </strong>

                          <small dir="ltr">
                            {order.userEmail ||
                              order.userPhone ||
                              '—'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong className="admin-order-price">
                        {formatMoney(
                          order.totalAmount,
                        )}{' '}
                        ریال
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`admin-status admin-status--${order.status.toLowerCase()}`}
                      >
                        {statusLabels[
                          order.status
                        ] || order.status}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`admin-payment-status admin-payment-status--${order.paymentStatus.toLowerCase()}`}
                      >
                        {paymentLabels[
                          order.paymentStatus
                        ] ||
                          order.paymentStatus}
                      </span>
                    </td>

                    <td>
                      {new Intl.NumberFormat(
                        'fa-IR',
                      ).format(
                        order.itemCount ??
                          order.totalQuantity ??
                          0,
                      )}
                    </td>

                    <td>
                      <time>
                        {formatDate(
                          order.createdAt,
                        )}
                      </time>
                    </td>

                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        aria-label={`مشاهده سفارش ${order.orderNumber}`}
                      >
                        جزئیات
                        <ArrowLeft
                          aria-hidden="true"
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {orders.length > 0 ? (
          <footer className="admin-orders-pagination">
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1),
                )
              }
              disabled={
                loading || meta.page <= 1
              }
            >
              <ChevronRight
                aria-hidden="true"
              />
              صفحه قبل
            </button>

            <span>
              {new Intl.NumberFormat(
                'fa-IR',
              ).format(meta.total)}{' '}
              سفارش
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    meta.totalPages,
                    current + 1,
                  ),
                )
              }
              disabled={
                loading ||
                meta.page >= meta.totalPages
              }
            >
              صفحه بعد
              <ChevronLeft
                aria-hidden="true"
              />
            </button>
          </footer>
        ) : null}
      </section>

      <button
        type="button"
        className="admin-orders-floating-refresh"
        onClick={loadOrders}
        disabled={loading}
        aria-label="به‌روزرسانی سفارش‌ها"
      >
        <RefreshCcw
          className={
            loading ? 'is-spinning' : ''
          }
          aria-hidden="true"
        />
      </button>
    </main>
  );
}
