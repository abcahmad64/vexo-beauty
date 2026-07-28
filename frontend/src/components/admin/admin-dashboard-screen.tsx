'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  PackageSearch,
  ShieldAlert,
  Sparkles,
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
  AdminCommandCenterData,
} from '@/types/admin';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readNumber(
  source: unknown,
  keys: string[],
): number | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  for (const value of Object.values(source)) {
    const nested = readNumber(value, keys);

    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

function readArray(
  source: unknown,
  keys: string[],
): unknown[] {
  if (!isRecord(source)) {
    return [];
  }

  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(source)) {
    const nested = readArray(value, keys);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function formatCount(value: number | null) {
  return new Intl.NumberFormat('fa-IR').format(
    value ?? 0,
  );
}

function formatDate(value?: string) {
  if (!value) {
    return 'زمان تولید نامشخص';
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

export function AdminDashboardScreen() {
  const [data, setData] =
    useState<AdminCommandCenterData | null>(null);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] =
    useState(false);
  const [forbidden, setForbidden] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        '/api/admin/command-center?chartDays=30&actionLimit=10&timelineLimit=20',
        {
          cache: 'no-store',
        },
      );

      const payload =
        (await response.json()) as AdminApiEnvelope<AdminCommandCenterData>;

      if (response.status === 401) {
        setUnauthorized(true);
        setForbidden(false);
        setData(null);
        return;
      }

      if (response.status === 403) {
        setForbidden(true);
        setUnauthorized(false);
        setData(null);
        return;
      }

      if (
        !response.ok ||
        payload.success !== true ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'دریافت داشبورد مدیریت انجام نشد.',
        );
      }

      setUnauthorized(false);
      setForbidden(false);
      setData(payload.data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت داشبورد مدیریت انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const dashboard = data?.dashboard;

    return [
      {
        label: 'سفارش‌ها',
        value: readNumber(dashboard, [
          'totalOrders',
          'ordersCount',
          'orders',
        ]),
        icon: ClipboardList,
      },
      {
        label: 'محصولات',
        value: readNumber(dashboard, [
          'totalProducts',
          'productsCount',
          'products',
        ]),
        icon: PackageSearch,
      },
      {
        label: 'اقدام‌های بحرانی',
        value: readNumber(data?.actionCenter, [
          'critical',
          'criticalCount',
        ]),
        icon: AlertTriangle,
      },
      {
        label: 'امتیاز سلامت',
        value:
          typeof data?.status?.score === 'number'
            ? data.status.score
            : null,
        icon: CircleGauge,
      },
    ];
  }, [data]);

  const actions = useMemo(
    () =>
      readArray(data?.actionCenter, [
        'items',
        'actions',
        'data',
      ]).slice(0, 8),
    [data],
  );

  const timeline = useMemo(
    () =>
      readArray(data?.timeline, [
        'items',
        'events',
        'data',
      ]).slice(0, 8),
    [data],
  );

  if (loading && !data) {
    return (
      <main className="admin-page">
        <div className="admin-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <p>در حال دریافت مرکز فرماندهی...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="admin-page">
        <div className="admin-state">
          <LockKeyhole aria-hidden="true" />
          <h1>ورود مدیریتی لازم است</h1>
          <p>
            برای ورود به پنل مدیریت ابتدا با حساب دارای
            دسترسی ادمین وارد شوید.
          </p>
          <Link
            href="/admin/login?next=%2Fadmin"
            className="button button--primary"
          >
            ورود به حساب
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  if (forbidden) {
    return (
      <main className="admin-page">
        <div className="admin-state">
          <ShieldAlert aria-hidden="true" />
          <h1>دسترسی مدیریت ندارید</h1>
          <p>
            نشست شما معتبر است، اما نقش یا مجوز لازم برای
            مشاهده پنل مدیریت به این حساب اختصاص داده نشده
            است.
          </p>
          <Link
            href="/"
            className="button button--primary"
          >
            بازگشت به فروشگاه
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminHeader
        title="مرکز فرماندهی فروشگاه"
        subtitle="خلاصه زنده عملیات، ریسک‌ها و اقدام‌های مدیریتی"
        onRefresh={loadDashboard}
        refreshing={loading}
      />

      {message ? (
        <p className="admin-message" role="alert">
          {message}
        </p>
      ) : null}

      <section className="admin-health-banner">
        <span
          className={
            data?.status?.value === 'stable'
              ? 'admin-health-banner__icon is-stable'
              : 'admin-health-banner__icon'
          }
        >
          {data?.status?.value === 'stable' ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
        </span>

        <div>
          <span>وضعیت کلی عملیات</span>
          <strong>
            {data?.status?.label ||
              'اطلاعات وضعیت در دسترس نیست'}
          </strong>
          <p>
            {data?.status?.message ||
              'Backend هنوز پیام وضعیت ارائه نکرده است.'}
          </p>
        </div>

        <small>
          آخرین تولید:{' '}
          {formatDate(data?.meta?.generatedAt)}
        </small>
      </section>

      <section
        className="admin-metrics"
        aria-label="شاخص‌های مدیریتی"
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="admin-metric-card"
            >
              <span>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <small>{metric.label}</small>
                <strong>
                  {formatCount(metric.value)}
                </strong>
              </div>
            </article>
          );
        })}
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <header className="admin-panel__header">
            <div>
              <span className="panel-label">
                Action Center
              </span>
              <h2>اقدام‌های فوری</h2>
            </div>

            <Link href="/admin/orders">
              مشاهده سفارش‌ها
              <ArrowLeft aria-hidden="true" />
            </Link>
          </header>

          {actions.length > 0 ? (
            <div className="admin-list">
              {actions.map((item, index) => (
                <article
                  key={index}
                  className="admin-list-item"
                >
                  <span>
                    <AlertTriangle aria-hidden="true" />
                  </span>
                  <div>
                    <strong>
                      {isRecord(item) &&
                      typeof item.title === 'string'
                        ? item.title
                        : `اقدام مدیریتی ${index + 1}`}
                    </strong>
                    <p>
                      {isRecord(item) &&
                      typeof item.message === 'string'
                        ? item.message
                        : isRecord(item) &&
                            typeof item.description ===
                              'string'
                          ? item.description
                          : 'جزئیات این اقدام از Backend دریافت شده است.'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-panel__empty">
              <CheckCircle2 aria-hidden="true" />
              <p>اقدام فوری برای نمایش وجود ندارد.</p>
            </div>
          )}
        </section>

        <section className="admin-panel">
          <header className="admin-panel__header">
            <div>
              <span className="panel-label">
                Intelligence
              </span>
              <h2>تحلیل مدیریتی</h2>
            </div>

            <Sparkles aria-hidden="true" />
          </header>

          <div className="admin-insight-card">
            <CircleGauge aria-hidden="true" />

            <div>
              <span>امتیاز وضعیت</span>
              <strong>
                {formatCount(
                  typeof data?.status?.score === 'number'
                    ? data.status.score
                    : null,
                )}
              </strong>
              <p>
                {data?.status?.message ||
                  'تحلیل وضعیت عملیاتی هنوز پیام قابل نمایش ندارد.'}
              </p>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-panel--wide">
          <header className="admin-panel__header">
            <div>
              <span className="panel-label">
                Timeline
              </span>
              <h2>رویدادهای اخیر</h2>
            </div>

            <Clock3 aria-hidden="true" />
          </header>

          {timeline.length > 0 ? (
            <div className="admin-timeline">
              {timeline.map((item, index) => (
                <article key={index}>
                  <span />
                  <div>
                    <strong>
                      {isRecord(item) &&
                      typeof item.title === 'string'
                        ? item.title
                        : `رویداد مدیریتی ${index + 1}`}
                    </strong>
                    <p>
                      {isRecord(item) &&
                      typeof item.message === 'string'
                        ? item.message
                        : isRecord(item) &&
                            typeof item.description ===
                              'string'
                          ? item.description
                          : 'جزئیات رویداد از Backend دریافت شده است.'}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-panel__empty">
              <Clock3 aria-hidden="true" />
              <p>رویداد جدیدی برای نمایش وجود ندارد.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
