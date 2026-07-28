'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Package,
  ReceiptText,
  RefreshCcw,
  Send,
  ShoppingBag,
  Truck,
  UserRound,
  XCircle,
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
  AdminOrderAddress,
  AdminOrderDetail,
  AdminOrderNote,
  AdminOrderNotesPayload,
  AdminOrderTimelineItem,
  AdminOrderTimelinePayload,
} from '@/types/admin';

type AdminOrderDetailScreenProps = {
  orderId: string;
};

type TimelineResponse =
  | AdminOrderTimelinePayload
  | AdminOrderTimelineItem[];

type NotesResponse =
  | AdminOrderNotesPayload
  | AdminOrderNote[];

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  CONFIRMED: 'تأییدشده',
  PROCESSING: 'در حال آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  REFUNDED: 'مرجوع‌شده',
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'در انتظار پرداخت',
  COMPLETED: 'پرداخت‌شده',
  FAILED: 'ناموفق',
  REFUNDED: 'بازپرداخت‌شده',
  PARTIAL_REFUNDED: 'بازپرداخت جزئی',
};

const paymentMethodLabels: Record<string, string> = {
  ZARINPAL: 'زرین‌پال',
  IDPAY: 'آیدی‌پی',
  CASH: 'پرداخت نقدی',
  CARD: 'کارت',
  WALLET: 'کیف پول',
};

const orderStatusOptions = [
  ['PENDING', 'در انتظار بررسی'],
  ['CONFIRMED', 'تأییدشده'],
  ['PROCESSING', 'در حال آماده‌سازی'],
  ['SHIPPED', 'ارسال‌شده'],
  ['DELIVERED', 'تحویل‌شده'],
  ['CANCELLED', 'لغوشده'],
  ['REFUNDED', 'مرجوع‌شده'],
] as const;

const paymentStatusOptions = [
  ['PENDING', 'در انتظار پرداخت'],
  ['COMPLETED', 'پرداخت‌شده'],
  ['FAILED', 'ناموفق'],
  ['REFUNDED', 'بازپرداخت‌شده'],
  ['PARTIAL_REFUNDED', 'بازپرداخت جزئی'],
] as const;

const paymentMethodOptions = [
  ['', 'بدون تغییر روش پرداخت'],
  ['ZARINPAL', 'زرین‌پال'],
  ['IDPAY', 'آیدی‌پی'],
  ['CASH', 'پرداخت نقدی'],
  ['CARD', 'کارت'],
  ['WALLET', 'کیف پول'],
] as const;

const sourceLabels: Record<string, string> = {
  order: 'سفارش',
  payment: 'پرداخت',
  refund: 'بازگشت وجه',
  event: 'رویداد',
};

function textValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function booleanValue(value: unknown) {
  return value === true;
}

function formatMoney(
  value: string | number | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat('fa-IR').format(
    Number.isFinite(value ?? NaN) ? value ?? 0 : 0,
  );
}

function formatDate(
  value?: string | null,
  persianValue?: string | null,
) {
  if (persianValue) {
    return persianValue;
  }

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

function statusLabel(value?: string | null) {
  if (!value) {
    return 'ثبت نشده';
  }

  return statusLabels[value] ?? value;
}

function paymentStatusLabel(value?: string | null) {
  if (!value) {
    return 'ثبت نشده';
  }

  return paymentStatusLabels[value] ?? value;
}

function paymentMethodLabel(value?: string | null) {
  if (!value) {
    return 'ثبت نشده';
  }

  return paymentMethodLabels[value] ?? value;
}

function parseTimeline(
  payload: TimelineResponse,
): AdminOrderTimelineItem[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload.data)
    ? payload.data
    : [];
}

function parseNotes(
  payload: NotesResponse,
): AdminOrderNote[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload.data)
    ? payload.data
    : [];
}

function safeExternalUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function customerName(order: AdminOrderDetail) {
  return (
    order.user.fullName ||
    order.user.email ||
    order.user.phone ||
    'مشتری ثبت‌شده'
  );
}

function AddressCard({
  title,
  address,
}: {
  title: string;
  address: AdminOrderAddress | null;
}) {
  return (
    <article className="admin-order-address">
      <header>
        <MapPin aria-hidden="true" />
        <div>
          <span>{title}</span>
          <strong>
            {address?.title || 'آدرس سفارش'}
          </strong>
        </div>
      </header>

      {address ? (
        <dl>
          <div>
            <dt>تحویل‌گیرنده</dt>
            <dd>{address.fullName || '—'}</dd>
          </div>

          <div>
            <dt>شماره تماس</dt>
            <dd>
              <bdi dir="ltr">{address.phone}</bdi>
            </dd>
          </div>

          <div>
            <dt>نشانی</dt>
            <dd>
              {[
                address.country,
                address.state,
                address.city,
                address.street,
                address.apartment,
              ]
                .filter(Boolean)
                .join('، ')}
            </dd>
          </div>

          <div>
            <dt>کد پستی</dt>
            <dd>
              {address.postalCode ? (
                <bdi dir="ltr">
                  {address.postalCode}
                </bdi>
              ) : (
                'ثبت نشده'
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="admin-order-empty-text">
          آدرسی برای این بخش ثبت نشده است.
        </p>
      )}
    </article>
  );
}

export function AdminOrderDetailScreen({
  orderId,
}: AdminOrderDetailScreenProps) {
  const [order, setOrder] =
    useState<AdminOrderDetail | null>(null);

  const [timeline, setTimeline] = useState<
    AdminOrderTimelineItem[]
  >([]);

  const [notes, setNotes] =
    useState<AdminOrderNote[]>([]);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [importantNote, setImportantNote] =
    useState(false);

  const [notePending, setNotePending] =
    useState(false);

  /* ADMIN_ORDER_ACTIONS_V1 */

  const [orderStatusDraft, setOrderStatusDraft] =
    useState('');

  const [trackingNumberDraft, setTrackingNumberDraft] =
    useState('');

  const [orderStatusReason, setOrderStatusReason] =
    useState('');

  const [orderStatusPending, setOrderStatusPending] =
    useState(false);

  const [paymentStatusDraft, setPaymentStatusDraft] =
    useState('');

  const [paymentMethodDraft, setPaymentMethodDraft] =
    useState('');

  const [paymentStatusReason, setPaymentStatusReason] =
    useState('');

  const [paymentStatusPending, setPaymentStatusPending] =
    useState(false);

  const [actionFeedback, setActionFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setNotFound(false);

    try {
      const encodedId = encodeURIComponent(orderId);

      const [
        orderResponse,
        timelineResponse,
        notesResponse,
      ] = await Promise.all([
        fetch(`/api/admin/orders/${encodedId}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/admin/orders/${encodedId}/timeline?limit=100`,
          {
            cache: 'no-store',
          },
        ),
        fetch(
          `/api/admin/orders/${encodedId}/notes?limit=50`,
          {
            cache: 'no-store',
          },
        ),
      ]);

      if (
        orderResponse.status === 401 ||
        timelineResponse.status === 401 ||
        notesResponse.status === 401
      ) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/orders/${orderId}`,
          )}`;
        return;
      }

      if (orderResponse.status === 404) {
        setNotFound(true);
        setOrder(null);
        return;
      }

      const orderEnvelope =
        (await orderResponse.json()) as AdminApiEnvelope<AdminOrderDetail>;

      if (
        !orderResponse.ok ||
        orderEnvelope.success !== true ||
        !orderEnvelope.data
      ) {
        throw new Error(
          orderEnvelope.message ||
            'دریافت جزئیات سفارش انجام نشد.',
        );
      }

      const freshOrder = orderEnvelope.data;

      setOrder(freshOrder);

      setOrderStatusDraft(freshOrder.status);
      setTrackingNumberDraft(
        freshOrder.shipping.trackingNumber ?? '',
      );

      setPaymentStatusDraft(
        freshOrder.payment.status,
      );

      setPaymentMethodDraft(
        freshOrder.payment.method ?? '',
      );

      if (timelineResponse.ok) {
        const timelineEnvelope =
          (await timelineResponse.json()) as AdminApiEnvelope<TimelineResponse>;

        if (
          timelineEnvelope.success === true &&
          timelineEnvelope.data
        ) {
          setTimeline(
            parseTimeline(timelineEnvelope.data),
          );
        } else {
          setTimeline([]);
        }
      } else {
        setTimeline([]);
      }

      if (notesResponse.ok) {
        const notesEnvelope =
          (await notesResponse.json()) as AdminApiEnvelope<NotesResponse>;

        if (
          notesEnvelope.success === true &&
          notesEnvelope.data
        ) {
          setNotes(parseNotes(notesEnvelope.data));
        } else {
          setNotes([]);
        }
      } else {
        setNotes([]);
      }
    } catch (error) {
      setOrder(null);
      setTimeline([]);
      setNotes([]);

      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت جزئیات سفارش انجام نشد.',
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

  const metrics = useMemo(() => {
    if (!order) {
      return [];
    }

    return [
      {
        label: 'تعداد اقلام',
        value: formatCount(
          order.itemsSummary.itemCount,
        ),
        icon: ShoppingBag,
      },
      {
        label: 'تعداد کالا',
        value: formatCount(
          order.itemsSummary.totalQuantity,
        ),
        icon: Package,
      },
      {
        label: 'مبلغ پرداخت‌شده',
        value: `${formatMoney(
          order.amounts.paidAmount,
        )} ریال`,
        icon: CircleDollarSign,
      },
      {
        label: 'خالص پرداخت',
        value: `${formatMoney(
          order.amounts.netPaidAmount,
        )} ریال`,
        icon: Banknote,
      },
    ];
  }, [order]);

  async function submitOrderStatus(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !orderStatusDraft ||
      orderStatusPending ||
      paymentStatusPending
    ) {
      return;
    }

    setOrderStatusPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(
          orderId,
        )}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: orderStatusDraft,
            trackingNumber:
              trackingNumberDraft.trim() ||
              undefined,
            reason:
              orderStatusReason.trim() ||
              undefined,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/orders/${orderId}`,
          )}`;
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'تغییر وضعیت سفارش انجام نشد.',
        );
      }

      setOrderStatusReason('');

      await loadOrder();

      setActionFeedback({
        tone: 'success',
        message:
          'وضعیت سفارش با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تغییر وضعیت سفارش انجام نشد.',
      });
    } finally {
      setOrderStatusPending(false);
    }
  }

  async function submitPaymentStatus(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !paymentStatusDraft ||
      paymentStatusPending ||
      orderStatusPending
    ) {
      return;
    }

    setPaymentStatusPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(
          orderId,
        )}/payment-status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentStatus:
              paymentStatusDraft,
            paymentMethod:
              paymentMethodDraft ||
              undefined,
            reason:
              paymentStatusReason.trim() ||
              undefined,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/orders/${orderId}`,
          )}`;
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'تغییر وضعیت پرداخت انجام نشد.',
        );
      }

      setPaymentStatusReason('');

      await loadOrder();

      setActionFeedback({
        tone: 'success',
        message:
          'وضعیت پرداخت با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تغییر وضعیت پرداخت انجام نشد.',
      });
    } finally {
      setPaymentStatusPending(false);
    }
  }

  async function submitNote(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const note = noteText.trim();

    if (!note || notePending) {
      return;
    }

    setNotePending(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(
          orderId,
        )}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note,
            isImportant: importantNote,
            visibility: 'admin',
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/orders/${orderId}`,
          )}`;
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ثبت یادداشت انجام نشد.',
        );
      }

      setNoteText('');
      setImportantNote(false);

      const notesResponse = await fetch(
        `/api/admin/orders/${encodeURIComponent(
          orderId,
        )}/notes?limit=50`,
        {
          cache: 'no-store',
        },
      );

      if (notesResponse.ok) {
        const notesEnvelope =
          (await notesResponse.json()) as AdminApiEnvelope<NotesResponse>;

        if (
          notesEnvelope.success === true &&
          notesEnvelope.data
        ) {
          setNotes(
            parseNotes(notesEnvelope.data),
          );
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'ثبت یادداشت انجام نشد.',
      );
    } finally {
      setNotePending(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="جزئیات سفارش"
          subtitle="در حال دریافت اطلاعات سفارش"
          refreshing
        />

        <section className="admin-order-detail-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <strong>
            در حال دریافت جزئیات سفارش...
          </strong>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="سفارش پیدا نشد"
          subtitle="شناسه سفارش معتبر نیست یا سفارش در دسترس نیست"
        />

        <section className="admin-order-detail-state">
          <XCircle aria-hidden="true" />
          <strong>سفارش موردنظر پیدا نشد</strong>
          <p>
            ممکن است سفارش حذف شده باشد یا شناسهٔ
            ارسال‌شده معتبر نباشد.
          </p>
          <Link
            href="/admin/orders"
            className="button button--primary"
          >
            بازگشت به سفارش‌ها
            <ArrowLeft aria-hidden="true" />
          </Link>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="جزئیات سفارش"
          subtitle="اطلاعات سفارش دریافت نشد"
          onRefresh={loadOrder}
        />

        <section className="admin-order-detail-state">
          <AlertTriangle aria-hidden="true" />
          <strong>
            دریافت سفارش امکان‌پذیر نبود
          </strong>
          <p>
            {message ||
              'ارتباط با سرویس سفارش را بررسی کنید.'}
          </p>
          <button
            type="button"
            className="button button--primary"
            onClick={loadOrder}
          >
            تلاش دوباره
            <RefreshCcw aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminHeader
        title={`سفارش ${order.orderNumber}`}
        subtitle={`ثبت‌شده در ${formatDate(
          order.createdAt,
          order.createdAtFa,
        )}`}
        onRefresh={loadOrder}
        refreshing={loading}
      />

      <nav
        className="admin-order-breadcrumbs"
        aria-label="مسیر صفحه"
      >
        <Link href="/admin">داشبورد</Link>
        <ArrowLeft aria-hidden="true" />
        <Link href="/admin/orders">
          سفارش‌ها
        </Link>
        <ArrowLeft aria-hidden="true" />
        <span>
          <bdi dir="ltr">
            {order.orderNumber}
          </bdi>
        </span>
      </nav>

      {message ? (
        <p className="admin-message" role="alert">
          {message}
        </p>
      ) : null}

      {actionFeedback ? (
        <p
          className={`admin-order-action-feedback is-${actionFeedback.tone}`}
          role={
            actionFeedback.tone === 'error'
              ? 'alert'
              : 'status'
          }
        >
          {actionFeedback.message}
        </p>
      ) : null}

      {order.deletedAt ? (
        <section className="admin-order-deleted-banner">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>
              این سفارش حذف نرم شده است
            </strong>
            <span>
              {formatDate(
                order.deletedAt,
                order.deletedAtFa,
              )}
            </span>
          </div>
        </section>
      ) : null}

      <section className="admin-order-detail-hero">
        <div>
          <span className="panel-label">
            ORDER DETAIL
          </span>

          <h2>
            <bdi dir="ltr">
              {order.orderNumber}
            </bdi>
          </h2>

          <p>
            شناسه سفارش:
            {' '}
            <bdi dir="ltr">{order.id}</bdi>
          </p>
        </div>

        <div className="admin-order-detail-statuses">
          <span
            className={`admin-order-badge is-${order.status.toLowerCase()}`}
          >
            {statusLabel(order.status)}
          </span>

          <span
            className={`admin-order-badge is-payment-${order.payment.status.toLowerCase()}`}
          >
            {paymentStatusLabel(
              order.payment.status,
            )}
          </span>
        </div>
      </section>

      <section className="admin-order-detail-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article key={metric.label}>
              <span>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <div className="admin-order-detail-layout">
        <div className="admin-order-detail-main">
          <section className="admin-order-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  CUSTOMER
                </span>
                <h2>اطلاعات مشتری</h2>
              </div>
              <UserRound aria-hidden="true" />
            </header>

            <dl className="admin-order-info-grid">
              <div>
                <dt>نام مشتری</dt>
                <dd>{customerName(order)}</dd>
              </div>

              <div>
                <dt>ایمیل</dt>
                <dd>
                  {order.user.email ? (
                    <bdi dir="ltr">
                      {order.user.email}
                    </bdi>
                  ) : (
                    'ثبت نشده'
                  )}
                </dd>
              </div>

              <div>
                <dt>شماره موبایل</dt>
                <dd>
                  {order.user.phone ? (
                    <bdi dir="ltr">
                      {order.user.phone}
                    </bdi>
                  ) : (
                    'ثبت نشده'
                  )}
                </dd>
              </div>

              <div>
                <dt>شناسه مشتری</dt>
                <dd>
                  <bdi dir="ltr">
                    {order.user.id}
                  </bdi>
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-order-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  ITEMS
                </span>
                <h2>اقلام سفارش</h2>
              </div>
              <ShoppingBag aria-hidden="true" />
            </header>

            {order.items.length > 0 ? (
              <div className="admin-order-items">
                {order.items.map((item) => (
                  <article key={item.id}>
                    <span className="admin-order-item-icon">
                      <Package aria-hidden="true" />
                    </span>

                    <div className="admin-order-item-copy">
                      <strong>
                        {item.productName}
                      </strong>

                      <span>
                        SKU:
                        {' '}
                        <bdi dir="ltr">
                          {item.sku}
                        </bdi>
                      </span>

                      <small>
                        تعداد:
                        {' '}
                        {formatCount(item.quantity)}
                      </small>
                    </div>

                    <dl>
                      <div>
                        <dt>قیمت واحد</dt>
                        <dd>
                          {formatMoney(item.price)}
                          {' '}
                          ریال
                        </dd>
                      </div>

                      <div>
                        <dt>تخفیف</dt>
                        <dd>
                          {formatMoney(item.discount)}
                          {' '}
                          ریال
                        </dd>
                      </div>

                      <div>
                        <dt>جمع</dt>
                        <dd>
                          {formatMoney(item.lineTotal)}
                          {' '}
                          ریال
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-order-empty-text">
                آیتمی برای این سفارش ثبت نشده است.
              </p>
            )}
          </section>

          <section className="admin-order-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  PAYMENTS
                </span>
                <h2>تراکنش‌های پرداخت</h2>
              </div>
              <CreditCard aria-hidden="true" />
            </header>

            {order.payments.length > 0 ? (
              <div className="admin-order-payments">
                {order.payments.map((payment) => {
                  const receiptUrl =
                    safeExternalUrl(
                      payment.receiptUrl,
                    );

                  return (
                    <article key={payment.id}>
                      <div className="admin-order-payment-head">
                        <span>
                          <CreditCard aria-hidden="true" />
                        </span>

                        <div>
                          <strong>
                            {paymentMethodLabel(
                              payment.paymentMethod,
                            )}
                          </strong>
                          <small>
                            {paymentStatusLabel(
                              payment.paymentStatus,
                            )}
                          </small>
                        </div>

                        <b>
                          {formatMoney(payment.amount)}
                          {' '}
                          ریال
                        </b>
                      </div>

                      <dl>
                        <div>
                          <dt>درگاه</dt>
                          <dd>
                            {payment.gateway || '—'}
                          </dd>
                        </div>

                        <div>
                          <dt>شناسه تراکنش</dt>
                          <dd>
                            {payment.transactionId ? (
                              <bdi dir="ltr">
                                {payment.transactionId}
                              </bdi>
                            ) : (
                              'ثبت نشده'
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>زمان پرداخت</dt>
                          <dd>
                            {formatDate(
                              payment.paidAt,
                              payment.paidAtFa,
                            )}
                          </dd>
                        </div>
                      </dl>

                      {receiptUrl ? (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          مشاهده رسید
                          <ArrowLeft aria-hidden="true" />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="admin-order-empty-text">
                تراکنش پرداختی برای این سفارش ثبت نشده است.
              </p>
            )}
          </section>

          <section className="admin-order-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  ADDRESSES
                </span>
                <h2>نشانی‌های سفارش</h2>
              </div>
              <MapPin aria-hidden="true" />
            </header>

            <div className="admin-order-address-grid">
              <AddressCard
                title="آدرس ارسال"
                address={order.shippingAddress}
              />

              <AddressCard
                title="آدرس صورتحساب"
                address={order.billingAddress}
              />
            </div>
          </section>

          <section className="admin-order-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  TIMELINE
                </span>
                <h2>تاریخچه سفارش</h2>
              </div>
              <Clock3 aria-hidden="true" />
            </header>

            {timeline.length > 0 ? (
              <div className="admin-order-timeline">
                {timeline.map((item) => (
                  <article
                    key={`${item.source}-${item.id}`}
                  >
                    <span className="admin-order-timeline__dot" />

                    <div>
                      <header>
                        <div>
                          <small>
                            {sourceLabels[item.source] ||
                              item.source}
                          </small>
                          <strong>{item.title}</strong>
                        </div>

                        <time
                          dateTime={item.occurredAt}
                        >
                          {formatDate(
                            item.occurredAt,
                            item.occurredAtFa,
                          )}
                        </time>
                      </header>

                      {item.description ? (
                        <p>{item.description}</p>
                      ) : null}

                      <footer>
                        {item.status ? (
                          <span>
                            {statusLabel(item.status)}
                          </span>
                        ) : null}

                        {item.amount !== null ? (
                          <b>
                            {formatMoney(item.amount)}
                            {' '}
                            ریال
                          </b>
                        ) : null}
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-order-empty-text">
                رویدادی برای این سفارش ثبت نشده است.
              </p>
            )}
          </section>
        </div>

        <aside className="admin-order-detail-aside">
          <section className="admin-order-actions-card">
            <header>
              <div>
                <span className="panel-label">
                  ACTION CENTER
                </span>
                <h2>عملیات مدیریتی</h2>
              </div>

              <span className="admin-order-actions-card__status">
                تغییرات در Backend ثبت می‌شوند
              </span>
            </header>

            <form
              className="admin-order-action-form"
              onSubmit={submitOrderStatus}
            >
              <div className="admin-order-action-form__heading">
                <strong>وضعیت سفارش</strong>
                <span>
                  وضعیت فعلی:
                  {' '}
                  {statusLabel(order.status)}
                </span>
              </div>

              <label>
                <span>وضعیت جدید</span>
                <select
                  value={orderStatusDraft}
                  onChange={(event) =>
                    setOrderStatusDraft(
                      event.target.value,
                    )
                  }
                  disabled={
                    orderStatusPending ||
                    paymentStatusPending
                  }
                >
                  {orderStatusOptions.map(
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
              </label>

              <label>
                <span>کد رهگیری</span>
                <input
                  value={trackingNumberDraft}
                  onChange={(event) =>
                    setTrackingNumberDraft(
                      event.target.value,
                    )
                  }
                  maxLength={180}
                  dir="ltr"
                  placeholder="کد رهگیری مرسوله"
                  disabled={
                    orderStatusPending ||
                    paymentStatusPending
                  }
                />
              </label>

              <label>
                <span>توضیح تغییر</span>
                <textarea
                  value={orderStatusReason}
                  onChange={(event) =>
                    setOrderStatusReason(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="دلیل یا توضیح داخلی تغییر وضعیت"
                  disabled={
                    orderStatusPending ||
                    paymentStatusPending
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  orderStatusPending ||
                  paymentStatusPending ||
                  !orderStatusDraft
                }
              >
                {orderStatusPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}

                ذخیره وضعیت سفارش
              </button>
            </form>

            <div className="admin-order-actions-card__divider" />

            <form
              className="admin-order-action-form"
              onSubmit={submitPaymentStatus}
            >
              <div className="admin-order-action-form__heading">
                <strong>وضعیت پرداخت</strong>
                <span>
                  وضعیت فعلی:
                  {' '}
                  {paymentStatusLabel(
                    order.payment.status,
                  )}
                </span>
              </div>

              <label>
                <span>وضعیت جدید پرداخت</span>
                <select
                  value={paymentStatusDraft}
                  onChange={(event) =>
                    setPaymentStatusDraft(
                      event.target.value,
                    )
                  }
                  disabled={
                    paymentStatusPending ||
                    orderStatusPending
                  }
                >
                  {paymentStatusOptions.map(
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
              </label>

              <label>
                <span>روش پرداخت</span>
                <select
                  value={paymentMethodDraft}
                  onChange={(event) =>
                    setPaymentMethodDraft(
                      event.target.value,
                    )
                  }
                  disabled={
                    paymentStatusPending ||
                    orderStatusPending
                  }
                >
                  {paymentMethodOptions.map(
                    ([value, label]) => (
                      <option
                        key={value || 'unchanged'}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>توضیح تغییر</span>
                <textarea
                  value={paymentStatusReason}
                  onChange={(event) =>
                    setPaymentStatusReason(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="دلیل یا توضیح داخلی تغییر پرداخت"
                  disabled={
                    paymentStatusPending ||
                    orderStatusPending
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  paymentStatusPending ||
                  orderStatusPending ||
                  !paymentStatusDraft
                }
              >
                {paymentStatusPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}

                ذخیره وضعیت پرداخت
              </button>
            </form>
          </section>

          <section className="admin-order-summary-card">
            <header>
              <ReceiptText aria-hidden="true" />
              <div>
                <span className="panel-label">
                  SUMMARY
                </span>
                <h2>خلاصه مالی</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>جمع کالاها</dt>
                <dd>
                  {formatMoney(
                    order.amounts.subtotal,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>تخفیف</dt>
                <dd>
                  {formatMoney(
                    order.amounts.discountAmount,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>هزینه ارسال</dt>
                <dd>
                  {formatMoney(
                    order.amounts.shippingAmount,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>مالیات</dt>
                <dd>
                  {formatMoney(
                    order.amounts.taxAmount,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div className="is-total">
                <dt>مبلغ نهایی</dt>
                <dd>
                  {formatMoney(
                    order.amounts.totalAmount,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>بازپرداخت</dt>
                <dd>
                  {formatMoney(
                    order.amounts.refundedAmount,
                  )}
                  {' '}
                  ریال
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-order-side-card">
            <header>
              <Truck aria-hidden="true" />
              <div>
                <span>ارسال سفارش</span>
                <strong>
                  {order.shipping.method ||
                    'روش ارسال ثبت نشده'}
                </strong>
              </div>
            </header>

            <dl>
              <div>
                <dt>کد رهگیری</dt>
                <dd>
                  {order.shipping.trackingNumber ? (
                    <bdi dir="ltr">
                      {order.shipping.trackingNumber}
                    </bdi>
                  ) : (
                    'ثبت نشده'
                  )}
                </dd>
              </div>

              <div>
                <dt>زمان ارسال</dt>
                <dd>
                  {formatDate(
                    order.shipping.shippedAt,
                    order.shipping.shippedAtFa,
                  )}
                </dd>
              </div>

              <div>
                <dt>زمان تحویل</dt>
                <dd>
                  {formatDate(
                    order.shipping.deliveredAt,
                    order.shipping.deliveredAtFa,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-order-side-card">
            <header>
              <FileText aria-hidden="true" />
              <div>
                <span>فاکتور</span>
                <strong>
                  {order.invoice.status ||
                    'فاکتور ثبت نشده'}
                </strong>
              </div>
            </header>

            <dl>
              <div>
                <dt>شناسه فاکتور</dt>
                <dd>
                  {order.invoice.id ? (
                    <bdi dir="ltr">
                      {order.invoice.id}
                    </bdi>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-order-side-card">
            <header>
              <CalendarClock aria-hidden="true" />
              <div>
                <span>زمان‌بندی</span>
                <strong>سوابق سفارش</strong>
              </div>
            </header>

            <dl>
              <div>
                <dt>ایجاد</dt>
                <dd>
                  {formatDate(
                    order.createdAt,
                    order.createdAtFa,
                  )}
                </dd>
              </div>

              <div>
                <dt>آخرین تغییر</dt>
                <dd>
                  {formatDate(
                    order.updatedAt,
                    order.updatedAtFa,
                  )}
                </dd>
              </div>

              <div>
                <dt>لغو</dt>
                <dd>
                  {formatDate(
                    order.cancelledAt,
                    order.cancelledAtFa,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-order-notes-card">
            <header>
              <MessageSquareText aria-hidden="true" />
              <div>
                <span className="panel-label">
                  NOTES
                </span>
                <h2>یادداشت مدیریتی</h2>
              </div>
            </header>

            <form onSubmit={submitNote}>
              <label htmlFor="admin-order-note">
                یادداشت جدید
              </label>

              <textarea
                id="admin-order-note"
                value={noteText}
                onChange={(event) =>
                  setNoteText(event.target.value)
                }
                maxLength={2000}
                rows={5}
                placeholder="یادداشت داخلی درباره سفارش..."
                disabled={notePending}
              />

              <div className="admin-order-note-options">
                <label>
                  <input
                    type="checkbox"
                    checked={importantNote}
                    onChange={(event) =>
                      setImportantNote(
                        event.target.checked,
                      )
                    }
                    disabled={notePending}
                  />
                  <span>
                    یادداشت مهم
                  </span>
                </label>

                <small>
                  {new Intl.NumberFormat(
                    'fa-IR',
                  ).format(noteText.length)}
                  {' '}
                  از ۲۰۰۰
                </small>
              </div>

              <button
                type="submit"
                disabled={
                  notePending ||
                  !noteText.trim()
                }
              >
                {notePending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <Send aria-hidden="true" />
                )}
                ثبت یادداشت
              </button>
            </form>

            <div className="admin-order-notes-list">
              {notes.length > 0 ? (
                notes.map((note) => {
                  const noteTextValue =
                    textValue(note.note);

                  return (
                    <article
                      key={note.id}
                      className={
                        booleanValue(
                          note.isImportant,
                        )
                          ? 'is-important'
                          : ''
                      }
                    >
                      <header>
                        <span>
                          {booleanValue(
                            note.isImportant,
                          ) ? (
                            <AlertTriangle
                              aria-hidden="true"
                            />
                          ) : (
                            <MessageSquareText
                              aria-hidden="true"
                            />
                          )}

                          {booleanValue(
                            note.isImportant,
                          )
                            ? 'مهم'
                            : 'یادداشت'}
                        </span>

                        <time
                          dateTime={note.createdAt}
                        >
                          {formatDate(
                            note.createdAt,
                            note.createdAtFa,
                          )}
                        </time>
                      </header>

                      <p>
                        {noteTextValue ||
                          'متن یادداشت در دسترس نیست.'}
                      </p>
                    </article>
                  );
                })
              ) : (
                <p className="admin-order-empty-text">
                  هنوز یادداشتی ثبت نشده است.
                </p>
              )}
            </div>
          </section>

          <Link
            href="/admin/orders"
            className="admin-order-back-link"
          >
            بازگشت به فهرست سفارش‌ها
            <ArrowLeft aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
