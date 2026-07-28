'use client';

/* ADMIN_COUPONS_SCREEN_V1 */

import {
  AlertTriangle,
  BadgePercent,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock3,
  Edit3,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  AdminApiEnvelope,
  AdminCouponDashboardPayload,
  AdminCouponListItem,
  AdminCouponListMeta,
  AdminCouponListPayload,
  AdminCouponMutationPayload,
  AdminCouponStatus,
  AdminCouponType,
} from '@/types/admin';

type CouponDraft = {
  code: string;
  type: AdminCouponType;
  value: string;
  description: string;
  minAmount: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  status: AdminCouponStatus;
  isActive: boolean;
};

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

const emptyMeta: AdminCouponListMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

const emptyDraft: CouponDraft = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  description: '',
  minAmount: '',
  usageLimit: '',
  startDate: '',
  endDate: '',
  status: 'ACTIVE',
  isActive: true,
};

const typeLabels: Record<AdminCouponType, string> = {
  PERCENTAGE: 'تخفیف درصدی',
  FIXED_AMOUNT: 'تخفیف مبلغی',
  FREE_SHIPPING: 'ارسال رایگان',
};

const statusLabels: Record<AdminCouponStatus, string> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  EXPIRED: 'منقضی',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function formatMoney(
  value: string | number | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'بدون محدودیت';
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

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function toIsoDate(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString();
}

function couponValueLabel(
  coupon: AdminCouponListItem,
) {
  if (coupon.type === 'FREE_SHIPPING') {
    return 'ارسال رایگان';
  }

  if (coupon.type === 'PERCENTAGE') {
    return `${formatNumber(Number(coupon.value))}٪`;
  }

  return `${formatMoney(coupon.value)} تومان`;
}

function couponStatusClass(
  coupon: AdminCouponListItem,
) {
  if (
    coupon.status === 'EXPIRED' ||
    coupon.flags.isExpired
  ) {
    return 'is-expired';
  }

  if (
    coupon.status === 'ACTIVE' &&
    coupon.isActive
  ) {
    return 'is-active';
  }

  return 'is-inactive';
}

function draftFromCoupon(
  coupon: AdminCouponListItem,
): CouponDraft {
  return {
    code: coupon.code,
    type: coupon.type,
    value:
      coupon.type === 'FREE_SHIPPING'
        ? ''
        : coupon.value,
    description: coupon.description ?? '',
    minAmount:
      Number(coupon.minAmount) > 0
        ? coupon.minAmount
        : '',
    usageLimit:
      coupon.usageLimit === null
        ? ''
        : String(coupon.usageLimit),
    startDate: toDateTimeLocal(
      coupon.startDate,
    ),
    endDate: toDateTimeLocal(coupon.endDate),
    status: coupon.status,
    isActive: coupon.isActive,
  };
}

export function AdminCouponsScreen() {
  const [coupons, setCoupons] = useState<
    AdminCouponListItem[]
  >([]);

  const [dashboard, setDashboard] =
    useState<AdminCouponDashboardPayload | null>(
      null,
    );

  const [meta, setMeta] =
    useState<AdminCouponListMeta>(emptyMeta);

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [typeFilter, setTypeFilter] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [sort, setSort] =
    useState('createdAt:desc');

  const [page, setPage] = useState(1);

  const [loading, setLoading] =
    useState(true);

  const [actionPendingId, setActionPendingId] =
    useState<string | null>(null);

  const [formPending, setFormPending] =
    useState(false);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const [editorOpen, setEditorOpen] =
    useState(false);

  const [editingCoupon, setEditingCoupon] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const [draft, setDraft] =
    useState<CouponDraft>(emptyDraft);

  const [deleteCandidate, setDeleteCandidate] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const listQuery = useMemo(() => {
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

    if (typeFilter) {
      params.set('type', typeFilter);
    }

    if (statusFilter) {
      params.set('status', statusFilter);
    }

    return params;
  }, [
    page,
    sort,
    statusFilter,
    submittedQuery,
    typeFilter,
  ]);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const filterQuery = new URLSearchParams();

      if (submittedQuery) {
        filterQuery.set('q', submittedQuery);
      }

      if (typeFilter) {
        filterQuery.set('type', typeFilter);
      }

      if (statusFilter) {
        filterQuery.set(
          'status',
          statusFilter,
        );
      }

      const [listResponse, dashboardResponse] =
        await Promise.all([
          fetch(
            `/api/admin/coupons?${listQuery.toString()}`,
            {
              cache: 'no-store',
            },
          ),
          fetch(
            `/api/admin/coupons/dashboard?${filterQuery.toString()}`,
            {
              cache: 'no-store',
            },
          ),
        ]);

      if (
        listResponse.status === 401 ||
        dashboardResponse.status === 401
      ) {
        window.location.href =
          '/admin/login?next=%2Fadmin%2Fcoupons';

        return;
      }

      const listEnvelope =
        (await listResponse.json()) as AdminApiEnvelope<AdminCouponListPayload>;

      const dashboardEnvelope =
        (await dashboardResponse.json()) as AdminApiEnvelope<AdminCouponDashboardPayload>;

      if (
        !listResponse.ok ||
        listEnvelope.success !== true ||
        !listEnvelope.data
      ) {
        throw new Error(
          listEnvelope.message ||
            'دریافت کدهای تخفیف انجام نشد.',
        );
      }

      setCoupons(
        Array.isArray(listEnvelope.data.data)
          ? listEnvelope.data.data
          : [],
      );

      setMeta(
        listEnvelope.data.meta ?? emptyMeta,
      );

      if (
        dashboardResponse.ok &&
        dashboardEnvelope.success === true &&
        dashboardEnvelope.data
      ) {
        setDashboard(
          dashboardEnvelope.data,
        );
      }
    } catch (error) {
      setCoupons([]);
      setMeta(emptyMeta);

      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'دریافت کدهای تخفیف انجام نشد.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    listQuery,
    statusFilter,
    submittedQuery,
    typeFilter,
  ]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadCoupons();
    }, 0);

    return () => {
      window.clearTimeout(task);
    };
  }, [loadCoupons]);

  function openCreateEditor() {
    setEditingCoupon(null);
    setDraft(emptyDraft);
    setFeedback(null);
    setEditorOpen(true);
  }

  function openEditEditor(
    coupon: AdminCouponListItem,
  ) {
    setEditingCoupon(coupon);
    setDraft(draftFromCoupon(coupon));
    setFeedback(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (formPending) {
      return;
    }

    setEditorOpen(false);
    setEditingCoupon(null);
    setDraft(emptyDraft);
  }

  function updateDraft<K extends keyof CouponDraft>(
    key: K,
    value: CouponDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitCoupon(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const code = draft.code.trim().toUpperCase();
    const value = draft.value.trim();
    const minAmount = draft.minAmount.trim();
    const usageLimit = draft.usageLimit.trim();

    if (!code) {
      setFeedback({
        tone: 'error',
        message: 'کد تخفیف الزامی است.',
      });
      return;
    }

    if (
      draft.type !== 'FREE_SHIPPING' &&
      !/^\d+(\.\d{1,2})?$/.test(value)
    ) {
      setFeedback({
        tone: 'error',
        message:
          'مقدار تخفیف باید یک عدد معتبر باشد.',
      });
      return;
    }

    if (
      draft.type === 'PERCENTAGE' &&
      Number(value) > 100
    ) {
      setFeedback({
        tone: 'error',
        message:
          'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.',
      });
      return;
    }

    if (
      usageLimit &&
      (!Number.isInteger(Number(usageLimit)) ||
        Number(usageLimit) < 1)
    ) {
      setFeedback({
        tone: 'error',
        message:
          'سقف مصرف باید یک عدد صحیح مثبت باشد.',
      });
      return;
    }

    const startDate = toIsoDate(
      draft.startDate,
    );

    const endDate = toIsoDate(
      draft.endDate,
    );

    if (
      startDate &&
      endDate &&
      new Date(endDate) < new Date(startDate)
    ) {
      setFeedback({
        tone: 'error',
        message:
          'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.',
      });
      return;
    }

    setFormPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        editingCoupon
          ? `/api/admin/coupons/${encodeURIComponent(
              editingCoupon.id,
            )}`
          : '/api/admin/coupons',
        {
          method: editingCoupon
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            type: draft.type,
            ...(draft.type !== 'FREE_SHIPPING'
              ? { value }
              : {}),
            ...(draft.description.trim()
              ? {
                  description:
                    draft.description.trim(),
                }
              : {}),
            ...(minAmount
              ? { minAmount }
              : {}),
            ...(usageLimit
              ? {
                  usageLimit:
                    Number(usageLimit),
                }
              : {}),
            ...(startDate
              ? { startDate }
              : {}),
            ...(endDate
              ? { endDate }
              : {}),
            ...(
              editingCoupon &&
              !endDate &&
              editingCoupon.endDate
                ? { clearEndDate: true }
                : {}
            ),
            status: draft.status,
            isActive: draft.isActive,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCouponMutationPayload>;

      if (response.status === 401) {
        window.location.href =
          '/admin/login?next=%2Fadmin%2Fcoupons';
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ذخیره کد تخفیف انجام نشد.',
        );
      }

      setEditorOpen(false);
      setEditingCoupon(null);
      setDraft(emptyDraft);

      setFeedback({
        tone: 'success',
        message: editingCoupon
          ? 'کد تخفیف با موفقیت ویرایش شد.'
          : 'کد تخفیف با موفقیت ایجاد شد.',
      });

      await loadCoupons();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ذخیره کد تخفیف انجام نشد.',
      });
    } finally {
      setFormPending(false);
    }
  }

  async function runCouponAction(
    coupon: AdminCouponListItem,
    action:
      | 'activate'
      | 'deactivate'
      | 'expire',
  ) {
    setActionPendingId(coupon.id);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/coupons/${encodeURIComponent(
          coupon.id,
        )}/${action}`,
        {
          method: 'PATCH',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCouponMutationPayload>;

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'تغییر وضعیت کد تخفیف انجام نشد.',
        );
      }

      setFeedback({
        tone: 'success',
        message:
          action === 'activate'
            ? 'کد تخفیف فعال شد.'
            : action === 'deactivate'
              ? 'کد تخفیف غیرفعال شد.'
              : 'کد تخفیف منقضی شد.',
      });

      await loadCoupons();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تغییر وضعیت انجام نشد.',
      });
    } finally {
      setActionPendingId(null);
    }
  }

  async function deleteCoupon() {
    if (!deleteCandidate) {
      return;
    }

    setActionPendingId(
      deleteCandidate.id,
    );

    try {
      const response = await fetch(
        `/api/admin/coupons/${encodeURIComponent(
          deleteCandidate.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'حذف کد تخفیف انجام نشد.',
        );
      }

      setDeleteCandidate(null);

      setFeedback({
        tone: 'success',
        message:
          'کد تخفیف با موفقیت حذف شد.',
      });

      await loadCoupons();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'حذف کد تخفیف انجام نشد.',
      });
    } finally {
      setActionPendingId(null);
    }
  }

  const dashboardCards = [
    {
      label: 'کل کوپن‌ها',
      value: dashboard?.total.count ?? meta.total,
      icon: BadgePercent,
    },
    {
      label: 'فعال',
      value: dashboard?.active.count ?? 0,
      icon: ShieldCheck,
    },
    {
      label: 'غیرفعال',
      value: dashboard?.inactive.count ?? 0,
      icon: CircleOff,
    },
    {
      label: 'منقضی',
      value: dashboard?.expired.count ?? 0,
      icon: Clock3,
    },
    {
      label: 'تکمیل ظرفیت',
      value: dashboard?.exhausted.count ?? 0,
      icon: Users,
    },
    {
      label: 'زمان‌بندی‌شده',
      value: dashboard?.scheduled.count ?? 0,
      icon: CalendarClock,
    },
  ];

  return (
    <section className="admin-coupons">
      <header className="admin-coupons__header">
        <div>
          <span>بازاریابی و فروش</span>
          <h1>کدهای تخفیف</h1>
          <p>
            ایجاد، زمان‌بندی و مدیریت مصرف کوپن‌ها
          </p>
        </div>

        <div className="admin-coupons__header-actions">
          <button
            type="button"
            className="admin-coupons__refresh"
            onClick={() => void loadCoupons()}
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

          <button
            type="button"
            className="admin-coupons__create"
            onClick={openCreateEditor}
          >
            <Plus aria-hidden="true" />
            ساخت کد تخفیف
          </button>
        </div>
      </header>

      {feedback ? (
        <div
          className={`admin-coupons__feedback is-${feedback.tone}`}
          role={
            feedback.tone === 'error'
              ? 'alert'
              : 'status'
          }
        >
          {feedback.tone === 'error' ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}

          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className="admin-coupons__metrics">
        {dashboardCards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label}>
              <Icon aria-hidden="true" />
              <div>
                <strong>
                  {formatNumber(card.value)}
                </strong>
                <span>{card.label}</span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="admin-coupons__toolbar">
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
            placeholder="جستجو در کد یا توضیحات"
            aria-label="جستجوی کد تخفیف"
          />

          <button type="submit">
            جستجو
          </button>
        </form>

        <select
          value={typeFilter}
          onChange={(event) => {
            setPage(1);
            setTypeFilter(
              event.target.value,
            );
          }}
          aria-label="فیلتر نوع کوپن"
        >
          <option value="">همه انواع</option>
          <option value="PERCENTAGE">
            درصدی
          </option>
          <option value="FIXED_AMOUNT">
            مبلغ ثابت
          </option>
          <option value="FREE_SHIPPING">
            ارسال رایگان
          </option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(
              event.target.value,
            );
          }}
          aria-label="فیلتر وضعیت کوپن"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="INACTIVE">
            غیرفعال
          </option>
          <option value="EXPIRED">
            منقضی
          </option>
        </select>

        <select
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value);
          }}
          aria-label="مرتب‌سازی کوپن‌ها"
        >
          <option value="createdAt:desc">
            جدیدترین
          </option>
          <option value="updatedAt:desc">
            آخرین ویرایش
          </option>
          <option value="code:asc">
            کد؛ صعودی
          </option>
          <option value="usageCount:desc">
            بیشترین مصرف
          </option>
          <option value="revenueAmount:desc">
            بیشترین درآمد
          </option>
        </select>
      </div>

      <div className="admin-coupons__table-card">
        {loading ? (
          <div className="admin-coupons__state">
            <LoaderCircle
              className="is-spinning"
              aria-hidden="true"
            />
            <span>
              در حال دریافت کدهای تخفیف...
            </span>
          </div>
        ) : coupons.length === 0 ? (
          <div className="admin-coupons__state">
            <BadgePercent aria-hidden="true" />
            <strong>
              کد تخفیفی پیدا نشد
            </strong>
            <span>
              فیلترها را تغییر بده یا یک کد
              جدید بساز.
            </span>
          </div>
        ) : (
          <div className="admin-coupons__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>کد و نوع</th>
                  <th>تخفیف</th>
                  <th>وضعیت</th>
                  <th>مصرف</th>
                  <th>درآمد</th>
                  <th>بازه اعتبار</th>
                  <th>عملیات</th>
                </tr>
              </thead>

              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <div className="admin-coupons__identity">
                        <code>{coupon.code}</code>
                        <span>
                          {typeLabels[coupon.type]}
                        </span>
                        {coupon.description ? (
                          <small>
                            {coupon.description}
                          </small>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <strong>
                        {couponValueLabel(coupon)}
                      </strong>

                      <small>
                        حداقل سفارش:
                        {' '}
                        {Number(
                          coupon.minAmount,
                        ) > 0
                          ? `${formatMoney(
                              coupon.minAmount,
                            )} تومان`
                          : 'ندارد'}
                      </small>
                    </td>

                    <td>
                      <span
                        className={`admin-coupons__status ${couponStatusClass(
                          coupon,
                        )}`}
                      >
                        {coupon.flags.isScheduled
                          ? 'زمان‌بندی‌شده'
                          : coupon.flags.isExhausted
                            ? 'تکمیل ظرفیت'
                            : statusLabels[
                                coupon.status
                              ]}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatNumber(
                          coupon.usedCount,
                        )}
                        {coupon.usageLimit !== null
                          ? ` / ${formatNumber(
                              coupon.usageLimit,
                            )}`
                          : ''}
                      </strong>

                      <small>
                        {formatNumber(
                          coupon.stats.uniqueUserCount,
                        )}
                        {' '}
                        کاربر یکتا
                      </small>
                    </td>

                    <td>
                      <strong>
                        {formatMoney(
                          coupon.stats.revenueAmount,
                        )}
                        {' '}
                        تومان
                      </strong>

                      <small>
                        {formatNumber(
                          coupon.stats.orderCount,
                        )}
                        {' '}
                        سفارش
                      </small>
                    </td>

                    <td>
                      <small>
                        شروع:
                        {' '}
                        {formatDate(
                          coupon.startDate,
                        )}
                      </small>

                      <small>
                        پایان:
                        {' '}
                        {formatDate(
                          coupon.endDate,
                        )}
                      </small>
                    </td>

                    <td>
                      <div className="admin-coupons__row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEditEditor(coupon)
                          }
                          aria-label={`ویرایش ${coupon.code}`}
                        >
                          <Edit3 aria-hidden="true" />
                        </button>

                        {coupon.status ===
                          'ACTIVE' &&
                        coupon.isActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runCouponAction(
                                coupon,
                                'deactivate',
                              )
                            }
                            disabled={
                              actionPendingId ===
                              coupon.id
                            }
                            aria-label={`غیرفعال‌سازی ${coupon.code}`}
                          >
                            <CircleOff
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void runCouponAction(
                                coupon,
                                'activate',
                              )
                            }
                            disabled={
                              actionPendingId ===
                              coupon.id
                            }
                            aria-label={`فعال‌سازی ${coupon.code}`}
                          >
                            <ShieldCheck
                              aria-hidden="true"
                            />
                          </button>
                        )}

                        {coupon.status !==
                        'EXPIRED' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runCouponAction(
                                coupon,
                                'expire',
                              )
                            }
                            disabled={
                              actionPendingId ===
                              coupon.id
                            }
                            aria-label={`منقضی کردن ${coupon.code}`}
                          >
                            <Clock3
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="is-danger"
                          onClick={() =>
                            setDeleteCandidate(
                              coupon,
                            )
                          }
                          aria-label={`حذف ${coupon.code}`}
                        >
                          <Trash2
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="admin-coupons__pagination">
          <span>
            {formatNumber(meta.total)}
            {' '}
            کد تخفیف
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
            >
              <ChevronLeft
                aria-hidden="true"
              />
            </button>
          </div>
        </footer>
      </div>

      {editorOpen ? (
        <div
          className="admin-coupons__overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <section
            className="admin-coupons__drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-editor-title"
          >
            <header>
              <div>
                <span>
                  {editingCoupon
                    ? 'ویرایش کوپن'
                    : 'کوپن جدید'}
                </span>

                <h2 id="coupon-editor-title">
                  {editingCoupon
                    ? editingCoupon.code
                    : 'ساخت کد تخفیف'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={formPending}
                aria-label="بستن فرم"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <form onSubmit={submitCoupon}>
              <div className="admin-coupons__form-grid">
                <label>
                  <span>کد تخفیف</span>
                  <input
                    value={draft.code}
                    onChange={(event) =>
                      updateDraft(
                        'code',
                        event.target.value
                          .toUpperCase(),
                      )
                    }
                    maxLength={80}
                    required
                  />
                </label>

                <label>
                  <span>نوع تخفیف</span>
                  <select
                    value={draft.type}
                    onChange={(event) =>
                      updateDraft(
                        'type',
                        event.target
                          .value as AdminCouponType,
                      )
                    }
                  >
                    <option value="PERCENTAGE">
                      درصدی
                    </option>
                    <option value="FIXED_AMOUNT">
                      مبلغ ثابت
                    </option>
                    <option value="FREE_SHIPPING">
                      ارسال رایگان
                    </option>
                  </select>
                </label>

                {draft.type !==
                'FREE_SHIPPING' ? (
                  <label>
                    <span>
                      {draft.type ===
                      'PERCENTAGE'
                        ? 'درصد تخفیف'
                        : 'مبلغ تخفیف'}
                    </span>
                    <input
                      value={draft.value}
                      onChange={(event) =>
                        updateDraft(
                          'value',
                          event.target.value,
                        )
                      }
                      inputMode="decimal"
                      required
                    />
                  </label>
                ) : null}

                <label>
                  <span>حداقل مبلغ سفارش</span>
                  <input
                    value={draft.minAmount}
                    onChange={(event) =>
                      updateDraft(
                        'minAmount',
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    placeholder="اختیاری"
                  />
                </label>

                <label>
                  <span>سقف مصرف</span>
                  <input
                    value={draft.usageLimit}
                    onChange={(event) =>
                      updateDraft(
                        'usageLimit',
                        event.target.value,
                      )
                    }
                    inputMode="numeric"
                    placeholder="نامحدود"
                  />
                </label>

                <label>
                  <span>وضعیت</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft(
                        'status',
                        event.target
                          .value as AdminCouponStatus,
                      )
                    }
                  >
                    <option value="ACTIVE">
                      فعال
                    </option>
                    <option value="INACTIVE">
                      غیرفعال
                    </option>
                    <option value="EXPIRED">
                      منقضی
                    </option>
                  </select>
                </label>

                <label>
                  <span>شروع اعتبار</span>
                  <input
                    type="datetime-local"
                    value={draft.startDate}
                    onChange={(event) =>
                      updateDraft(
                        'startDate',
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>پایان اعتبار</span>
                  <input
                    type="datetime-local"
                    value={draft.endDate}
                    onChange={(event) =>
                      updateDraft(
                        'endDate',
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <label className="admin-coupons__description">
                <span>توضیحات</span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    updateDraft(
                      'description',
                      event.target.value,
                    )
                  }
                  maxLength={1000}
                  rows={4}
                />
              </label>

              <label className="admin-coupons__switch">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) =>
                    updateDraft(
                      'isActive',
                      event.target.checked,
                    )
                  }
                />

                <span>
                  این کد در سیستم فعال باشد
                </span>
              </label>

              <footer>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={formPending}
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="is-primary"
                  disabled={formPending}
                >
                  {formPending ? (
                    <LoaderCircle
                      className="is-spinning"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check aria-hidden="true" />
                  )}

                  {editingCoupon
                    ? 'ذخیره تغییرات'
                    : 'ایجاد کد تخفیف'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {deleteCandidate ? (
        <div className="admin-coupons__overlay">
          <section
            className="admin-coupons__confirm"
            role="alertdialog"
            aria-modal="true"
          >
            <AlertTriangle aria-hidden="true" />

            <h2>حذف کد تخفیف</h2>

            <p>
              کد
              {' '}
              <strong>
                {deleteCandidate.code}
              </strong>
              {' '}
              به‌صورت نرم حذف می‌شود.
            </p>

            <div>
              <button
                type="button"
                onClick={() =>
                  setDeleteCandidate(null)
                }
                disabled={
                  actionPendingId ===
                  deleteCandidate.id
                }
              >
                انصراف
              </button>

              <button
                type="button"
                className="is-danger"
                onClick={() =>
                  void deleteCoupon()
                }
                disabled={
                  actionPendingId ===
                  deleteCandidate.id
                }
              >
                <Trash2 aria-hidden="true" />
                حذف
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
