'use client';

/* ADMIN_CUSTOMERS_LIST_V1 */

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  LoaderCircle,
  LogIn,
  RefreshCcw,
  Search,
  ShoppingBag,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  AdminApiEnvelope,
  AdminCustomerListItem,
  AdminCustomerListPayload,
  AdminCustomerStatus,
} from '@/types/admin';

type Feedback = {
  tone: 'error';
  message: string;
};

const statusLabels: Record<
  AdminCustomerStatus,
  string
> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  SUSPENDED: 'تعلیق‌شده',
  DELETED: 'حذف‌شده',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(
    value,
  );
}

function formatMoney(value: string | number) {
  const amount = Number(value);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'ثبت نشده';
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

function customerName(
  customer: AdminCustomerListItem,
) {
  return (
    customer.fullName ||
    customer.phone ||
    customer.email ||
    'مشتری بدون نام'
  );
}

function customerInitials(
  customer: AdminCustomerListItem,
) {
  const value = customerName(customer).trim();

  return value.slice(0, 2).toUpperCase();
}

function statusClass(
  status: AdminCustomerStatus,
) {
  if (status === 'ACTIVE') {
    return 'is-active';
  }

  if (status === 'SUSPENDED') {
    return 'is-suspended';
  }

  if (status === 'DELETED') {
    return 'is-deleted';
  }

  return 'is-inactive';
}

export function AdminCustomersScreen() {
  const [customers, setCustomers] = useState<
    AdminCustomerListItem[]
  >([]);

  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [status, setStatus] = useState('');
  const [hasOrders, setHasOrders] =
    useState('');
  const [hasPayments, setHasPayments] =
    useState('');
  const [includeDeleted, setIncludeDeleted] =
    useState(false);

  const [sort, setSort] =
    useState('createdAt:desc');

  const [page, setPage] = useState(1);
  const [loading, setLoading] =
    useState(true);
  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const requestQuery = useMemo(() => {
    const [sortBy, sortDirection] =
      sort.split(':');

    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      sortBy,
      sortDirection,
    });

    if (submittedQuery) {
      params.set('q', submittedQuery);
    }

    if (status) {
      params.set('status', status);
    }

    if (hasOrders) {
      params.set('hasOrders', hasOrders);
    }

    if (hasPayments) {
      params.set(
        'hasPayments',
        hasPayments,
      );
    }

    if (includeDeleted) {
      params.set('includeDeleted', 'true');
    }

    return params;
  }, [
    hasOrders,
    hasPayments,
    includeDeleted,
    page,
    sort,
    status,
    submittedQuery,
  ]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users?${requestQuery.toString()}`,
        {
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        window.location.href =
          '/admin/login?next=%2Fadmin%2Fcustomers';

        return;
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCustomerListPayload>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت فهرست مشتریان انجام نشد.',
        );
      }

      setCustomers(
        Array.isArray(envelope.data.data)
          ? envelope.data.data
          : [],
      );

      setMeta(envelope.data.meta);
    } catch (error) {
      setCustomers([]);
      setMeta({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      });

      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'دریافت فهرست مشتریان انجام نشد.',
      });
    } finally {
      setLoading(false);
    }
  }, [requestQuery]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadCustomers();
    }, 0);

    return () => {
      window.clearTimeout(task);
    };
  }, [loadCustomers]);

  const totalSpent = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.stats.totalSpent),
    0,
  );

  const activeCount = customers.filter(
    (customer) =>
      customer.status === 'ACTIVE',
  ).length;

  const buyersCount = customers.filter(
    (customer) =>
      customer.stats.orderCount > 0,
  ).length;

  const activeSessions = customers.reduce(
    (sum, customer) =>
      sum + customer.stats.sessionCount,
    0,
  );

  function resetFilters() {
    setQuery('');
    setSubmittedQuery('');
    setStatus('');
    setHasOrders('');
    setHasPayments('');
    setIncludeDeleted(false);
    setSort('createdAt:desc');
    setPage(1);
  }

  return (
    <section className="admin-customers">
      <header className="admin-customers__header">
        <div>
          <span>مدیریت ارتباط با مشتری</span>
          <h1>مشتریان</h1>
          <p>
            مشاهده رفتار خرید، وضعیت حساب و
            فعالیت مشتریان فروشگاه
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadCustomers()
          }
          disabled={loading}
        >
          <RefreshCcw
            className={
              loading ? 'is-spinning' : ''
            }
            aria-hidden="true"
          />
          بازخوانی
        </button>
      </header>

      {feedback ? (
        <div
          className="admin-customers__feedback"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" />
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="admin-customers__metrics">
        <article>
          <Users aria-hidden="true" />
          <div>
            <strong>
              {formatNumber(meta.total)}
            </strong>
            <span>کل مشتریان</span>
          </div>
        </article>

        <article>
          <UserCheck aria-hidden="true" />
          <div>
            <strong>
              {formatNumber(activeCount)}
            </strong>
            <span>فعال در این صفحه</span>
          </div>
        </article>

        <article>
          <ShoppingBag aria-hidden="true" />
          <div>
            <strong>
              {formatNumber(buyersCount)}
            </strong>
            <span>دارای سفارش</span>
          </div>
        </article>

        <article>
          <CircleDollarSign
            aria-hidden="true"
          />
          <div>
            <strong>
              {formatMoney(totalSpent)}
            </strong>
            <span>خرید این صفحه — تومان</span>
          </div>
        </article>

        <article>
          <LogIn aria-hidden="true" />
          <div>
            <strong>
              {formatNumber(activeSessions)}
            </strong>
            <span>نشست ثبت‌شده</span>
          </div>
        </article>
      </div>

      <div className="admin-customers__toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSubmittedQuery(
              query.trim(),
            );
          }}
        >
          <Search aria-hidden="true" />

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="جستجو با نام، موبایل یا ایمیل"
            aria-label="جستجوی مشتری"
          />

          <button type="submit">
            جستجو
          </button>
        </form>

        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          aria-label="فیلتر وضعیت مشتری"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="INACTIVE">
            غیرفعال
          </option>
          <option value="SUSPENDED">
            تعلیق‌شده
          </option>
          <option value="DELETED">
            حذف‌شده
          </option>
        </select>

        <select
          value={hasOrders}
          onChange={(event) => {
            setPage(1);
            setHasOrders(
              event.target.value,
            );
          }}
          aria-label="فیلتر سفارش مشتری"
        >
          <option value="">
            همه مشتریان
          </option>
          <option value="true">
            دارای سفارش
          </option>
          <option value="false">
            بدون سفارش
          </option>
        </select>

        <select
          value={hasPayments}
          onChange={(event) => {
            setPage(1);
            setHasPayments(
              event.target.value,
            );
          }}
          aria-label="فیلتر پرداخت مشتری"
        >
          <option value="">
            همه پرداخت‌ها
          </option>
          <option value="true">
            دارای پرداخت
          </option>
          <option value="false">
            بدون پرداخت
          </option>
        </select>

        <select
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value);
          }}
          aria-label="مرتب‌سازی مشتریان"
        >
          <option value="createdAt:desc">
            جدیدترین ثبت‌نام
          </option>
          <option value="updatedAt:desc">
            آخرین تغییر
          </option>
          <option value="totalSpent:desc">
            بیشترین خرید
          </option>
          <option value="orderCount:desc">
            بیشترین سفارش
          </option>
          <option value="lastLoginAt:desc">
            آخرین ورود
          </option>
          <option value="lastOrderAt:desc">
            آخرین سفارش
          </option>
          <option value="firstName:asc">
            نام؛ صعودی
          </option>
        </select>

        <label className="admin-customers__deleted-filter">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(event) => {
              setPage(1);
              setIncludeDeleted(
                event.target.checked,
              );
            }}
          />
          <span>نمایش حذف‌شده‌ها</span>
        </label>

        <button
          type="button"
          className="admin-customers__reset"
          onClick={resetFilters}
        >
          پاک‌کردن فیلترها
        </button>
      </div>

      <div className="admin-customers__table-card">
        {loading ? (
          <div className="admin-customers__state">
            <LoaderCircle
              className="is-spinning"
              aria-hidden="true"
            />
            <span>
              در حال دریافت مشتریان...
            </span>
          </div>
        ) : customers.length === 0 ? (
          <div className="admin-customers__state">
            <UserRound aria-hidden="true" />
            <strong>
              مشتری‌ای پیدا نشد
            </strong>
            <span>
              عبارت جستجو یا فیلترها را تغییر
              بده.
            </span>
          </div>
        ) : (
          <div className="admin-customers__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>مشتری</th>
                  <th>وضعیت</th>
                  <th>سفارش‌ها</th>
                  <th>مجموع خرید</th>
                  <th>آخرین سفارش</th>
                  <th>آخرین ورود</th>
                  <th>نشست‌ها</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="admin-customers__identity">
                        <div className="admin-customers__avatar">
                          {customer.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                customer.avatarUrl
                              }
                              alt=""
                            />
                          ) : (
                            <span>
                              {customerInitials(
                                customer,
                              )}
                            </span>
                          )}
                        </div>

                        <div>
                          <strong>
                            {customerName(
                              customer,
                            )}
                          </strong>

                          <span>
                            {customer.phone ||
                              'شماره موبایل ثبت نشده'}
                          </span>

                          <small>
                            {customer.email ||
                              'ایمیل ثبت نشده'}
                          </small>

                          {customer.role?.name ? (
                            <b>
                              {customer.role.name}
                            </b>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`admin-customers__status ${statusClass(
                          customer.status,
                        )}`}
                      >
                        {
                          statusLabels[
                            customer.status
                          ]
                        }
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatNumber(
                          customer.stats
                            .orderCount,
                        )}
                      </strong>

                      <small>
                        {formatNumber(
                          customer.stats
                            .completedOrderCount,
                        )}
                        {' '}
                        تکمیل‌شده
                      </small>
                    </td>

                    <td>
                      <strong>
                        {formatMoney(
                          customer.stats
                            .totalSpent,
                        )}
                        {' '}
                        تومان
                      </strong>

                      <small>
                        {formatNumber(
                          customer.stats
                            .paymentCount,
                        )}
                        {' '}
                        پرداخت
                      </small>
                    </td>

                    <td>
                      <Clock3 aria-hidden="true" />
                      <span>
                        {formatDate(
                          customer.stats
                            .lastOrderAt,
                        )}
                      </span>
                    </td>

                    <td>
                      <LogIn aria-hidden="true" />
                      <span>
                        {formatDate(
                          customer.stats
                            .lastLoginAt,
                        )}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatNumber(
                          customer.stats
                            .sessionCount,
                        )}
                      </strong>

                      <small>
                        {formatNumber(
                          customer.stats
                            .unreadNotificationCount,
                        )}
                        {' '}
                        اعلان خوانده‌نشده
                      </small>
                    </td>

                    <td>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(
                          customer.id,
                        )}`}
                        className="admin-customers__view"
                        aria-label={`مشاهده ${customerName(
                          customer,
                        )}`}
                      >
                        <Eye aria-hidden="true" />
                        جزئیات
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="admin-customers__pagination">
          <span>
            {formatNumber(meta.total)}
            {' '}
            مشتری
          </span>

          <div>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1),
                )
              }
              aria-label="صفحه قبل"
            >
              <ChevronRight
                aria-hidden="true"
              />
            </button>

            <span>
              صفحه
              {' '}
              {formatNumber(page)}
              {' '}
              از
              {' '}
              {formatNumber(
                Math.max(
                  1,
                  meta.totalPages,
                ),
              )}
            </span>

            <button
              type="button"
              disabled={
                page >= meta.totalPages ||
                loading
              }
              onClick={() =>
                setPage((current) =>
                  current + 1,
                )
              }
              aria-label="صفحه بعد"
            >
              <ChevronLeft
                aria-hidden="true"
              />
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
