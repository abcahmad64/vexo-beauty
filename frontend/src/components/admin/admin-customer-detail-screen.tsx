'use client';

/* ADMIN_CUSTOMER_DETAIL_PROFILE_V1 */

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  FileText,
  LockKeyhole,
  LogOut,
  MoreVertical,
  Clock3,
  CreditCard,
  ExternalLink,
  Globe2,
  Laptop,
  LoaderCircle,
  LogIn,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldOff,
  ShoppingBag,
  Smartphone,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  AdminApiEnvelope,
  AdminCustomerActivityItem,
  AdminCustomerActivityPayload,
  AdminCustomerNote,
  AdminCustomerNotesPayload,
  AdminCustomerNoteVisibility,
  AdminCustomerProfile,
  AdminCustomerSessionRevokePayload,
  AdminCustomerStatus,
  AdminCustomerVipLevel,
} from '@/types/admin';

type AdminCustomerDetailScreenProps = {
  customerId: string;
};

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

type NoteDraft = {
  note: string;
  visibility: AdminCustomerNoteVisibility;
  isImportant: boolean;
};

type SegmentDraft = {
  segment: string;
  vipLevel: AdminCustomerVipLevel;
  tags: string;
  marketingAllowed: '' | 'true' | 'false';
  highRisk: boolean;
  reason: string;
};

type CustomerConfirmation =
  | {
      kind: 'status';
      status: AdminCustomerStatus;
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
    }
  | {
      kind: 'delete';
      title: string;
      message: string;
      confirmLabel: string;
      danger: true;
    }
  | {
      kind: 'restore';
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: 'revoke-sessions';
      title: string;
      message: string;
      confirmLabel: string;
      danger: true;
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

const vipLabels = {
  none: 'بدون سطح VIP',
  bronze: 'برنزی',
  silver: 'نقره‌ای',
  gold: 'طلایی',
  platinum: 'پلاتینیوم',
} as const;

const visibilityLabels: Record<
  AdminCustomerNoteVisibility,
  string
> = {
  admin: 'مدیریت',
  support: 'پشتیبانی',
  finance: 'مالی',
  private: 'خصوصی',
};

const emptyNoteDraft: NoteDraft = {
  note: '',
  visibility: 'admin',
  isImportant: false,
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

function activityIcon(source: string) {
  const normalized = source.toLowerCase();

  if (normalized === 'order') {
    return ShoppingBag;
  }

  if (normalized === 'payment') {
    return CreditCard;
  }

  if (normalized === 'session') {
    return LogIn;
  }

  if (normalized === 'notification') {
    return Bell;
  }

  if (normalized === 'event') {
    return Activity;
  }

  return FileText;
}

function activitySourceLabel(source: string) {
  const labels: Record<string, string> = {
    order: 'سفارش',
    payment: 'پرداخت',
    session: 'نشست',
    notification: 'اعلان',
    event: 'رویداد',
  };

  return labels[source.toLowerCase()] ?? source;
}

function orderStatusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: 'در انتظار',
    PROCESSING: 'در حال پردازش',
    SHIPPED: 'ارسال‌شده',
    DELIVERED: 'تحویل‌شده',
    CANCELLED: 'لغوشده',
    RETURNED: 'مرجوع‌شده',
  };

  return labels[value] ?? value;
}

function paymentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: 'در انتظار',
    PROCESSING: 'در حال پردازش',
    COMPLETED: 'تکمیل‌شده',
    FAILED: 'ناموفق',
    CANCELLED: 'لغوشده',
    REFUNDED: 'بازپرداخت‌شده',
    PARTIAL_REFUNDED: 'بازپرداخت جزئی',
  };

  return labels[value] ?? value;
}

function paymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    ONLINE: 'پرداخت آنلاین',
    CARD: 'کارت بانکی',
    WALLET: 'کیف پول',
    CASH: 'پرداخت نقدی',
    COD: 'پرداخت در محل',
    BANK_TRANSFER: 'انتقال بانکی',
  };

  return labels[value] ?? value;
}

function deviceIcon(userAgent?: string | null) {
  const normalized = (
    userAgent ?? ''
  ).toLowerCase();

  if (
    normalized.includes('mobile') ||
    normalized.includes('android') ||
    normalized.includes('iphone')
  ) {
    return Smartphone;
  }

  return Laptop;
}

function customerName(
  profile: AdminCustomerProfile,
) {
  const user = profile.user;

  return (
    user.fullName ||
    user.phone ||
    user.email ||
    'مشتری بدون نام'
  );
}

function customerInitials(
  profile: AdminCustomerProfile,
) {
  return customerName(profile)
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export function AdminCustomerDetailScreen({
  customerId,
}: AdminCustomerDetailScreenProps) {
  const [profile, setProfile] =
    useState<AdminCustomerProfile | null>(null);

  /* ADMIN_CUSTOMER_DETAIL_ACTIVITY_NOTES_V1 */

  const [activities, setActivities] = useState<
    AdminCustomerActivityItem[]
  >([]);

  const [notes, setNotes] = useState<
    AdminCustomerNote[]
  >([]);

  const [activityLoading, setActivityLoading] =
    useState(true);

  const [notesLoading, setNotesLoading] =
    useState(true);

  const [notePending, setNotePending] =
    useState(false);

  const [deletingNoteId, setDeletingNoteId] =
    useState<string | null>(null);

  const [noteDraft, setNoteDraft] =
    useState<NoteDraft>(emptyNoteDraft);

  /* ADMIN_CUSTOMER_DETAIL_ACTIONS_V1 */

  const [segmentDraft, setSegmentDraft] =
    useState<SegmentDraft>({
      segment: '',
      vipLevel: 'none',
      tags: '',
      marketingAllowed: '',
      highRisk: false,
      reason: '',
    });

  const [segmentPending, setSegmentPending] =
    useState(false);

  const [actionPending, setActionPending] =
    useState(false);

  const [actionsOpen, setActionsOpen] =
    useState(false);

  const [confirmation, setConfirmation] =
    useState<CustomerConfirmation | null>(
      null,
    );

  const [statusReason, setStatusReason] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/activity?limit=100`,
        {
          cache: 'no-store',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCustomerActivityPayload>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت فعالیت‌های مشتری انجام نشد.',
        );
      }

      setActivities(
        Array.isArray(envelope.data.data)
          ? envelope.data.data
          : [],
      );
    } catch (error) {
      setActivities([]);

      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'دریافت فعالیت‌های مشتری انجام نشد.',
      });
    } finally {
      setActivityLoading(false);
    }
  }, [customerId]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/notes?limit=100`,
        {
          cache: 'no-store',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCustomerNotesPayload>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت یادداشت‌های مشتری انجام نشد.',
        );
      }

      setNotes(
        Array.isArray(envelope.data.data)
          ? envelope.data.data
          : [],
      );
    } catch (error) {
      setNotes([]);

      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'دریافت یادداشت‌های مشتری انجام نشد.',
      });
    } finally {
      setNotesLoading(false);
    }
  }, [customerId]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/profile`,
        {
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/customers/${customerId}`,
          )}`;

        return;
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCustomerProfile>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت پروفایل مشتری انجام نشد.',
        );
      }

      setProfile(envelope.data);

      const nextSegment = envelope.data.segment;

      setSegmentDraft({
        segment: nextSegment.segment ?? '',
        vipLevel: nextSegment.vipLevel,
        tags: nextSegment.tags.join(', '),
        marketingAllowed:
          nextSegment.marketingAllowed === true
            ? 'true'
            : nextSegment.marketingAllowed === false
              ? 'false'
              : '',
        highRisk: nextSegment.highRisk,
        reason: '',
      });
    } catch (error) {
      setProfile(null);

      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'دریافت پروفایل مشتری انجام نشد.',
      });
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void Promise.all([
        loadProfile(),
        loadActivity(),
        loadNotes(),
      ]);
    }, 0);

    return () => {
      window.clearTimeout(task);
    };
  }, [
    loadActivity,
    loadNotes,
    loadProfile,
  ]);

  const refreshCustomerData = useCallback(
    async () => {
      await Promise.all([
        loadProfile(),
        loadActivity(),
        loadNotes(),
      ]);
    },
    [
      loadActivity,
      loadNotes,
      loadProfile,
    ],
  );

  async function submitSegment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const tags = segmentDraft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSegmentPending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/segment`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(segmentDraft.segment.trim()
              ? {
                  segment:
                    segmentDraft.segment.trim(),
                }
              : {}),
            vipLevel: segmentDraft.vipLevel,
            tags,
            ...(segmentDraft.marketingAllowed
              ? {
                  marketingAllowed:
                    segmentDraft.marketingAllowed ===
                    'true',
                }
              : {}),
            highRisk: segmentDraft.highRisk,
            ...(segmentDraft.reason.trim()
              ? {
                  reason:
                    segmentDraft.reason.trim(),
                }
              : {}),
          }),
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
            'ذخیره سگمنت مشتری انجام نشد.',
        );
      }

      setFeedback({
        tone: 'success',
        message:
          'اطلاعات CRM مشتری ذخیره شد.',
      });

      await refreshCustomerData();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ذخیره سگمنت مشتری انجام نشد.',
      });
    } finally {
      setSegmentPending(false);
    }
  }

  async function executeCustomerAction() {
    if (!confirmation) {
      return;
    }

    setActionPending(true);
    setFeedback(null);

    try {
      let response: Response;

      if (confirmation.kind === 'status') {
        response = await fetch(
          `/api/admin/users/${encodeURIComponent(
            customerId,
          )}/status`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              status: confirmation.status,
              ...(statusReason.trim()
                ? {
                    reason:
                      statusReason.trim(),
                  }
                : {}),
            }),
          },
        );
      } else if (
        confirmation.kind === 'delete'
      ) {
        response = await fetch(
          `/api/admin/users/${encodeURIComponent(
            customerId,
          )}`,
          {
            method: 'DELETE',
          },
        );
      } else if (
        confirmation.kind === 'restore'
      ) {
        response = await fetch(
          `/api/admin/users/${encodeURIComponent(
            customerId,
          )}/restore`,
          {
            method: 'PATCH',
          },
        );
      } else {
        response = await fetch(
          `/api/admin/users/${encodeURIComponent(
            customerId,
          )}/sessions/revoke`,
          {
            method: 'PATCH',
          },
        );
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<
          | AdminCustomerSessionRevokePayload
          | unknown
        >;

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'عملیات مدیریتی مشتری انجام نشد.',
        );
      }

      let message =
        'عملیات مدیریتی با موفقیت انجام شد.';

      if (confirmation.kind === 'status') {
        message =
          'وضعیت حساب مشتری تغییر کرد.';
      } else if (
        confirmation.kind === 'delete'
      ) {
        message =
          'حساب مشتری به‌صورت نرم حذف شد.';
      } else if (
        confirmation.kind === 'restore'
      ) {
        message =
          'حساب مشتری بازیابی شد.';
      } else {
        const payload =
          envelope.data as
            | AdminCustomerSessionRevokePayload
            | null;

        message = payload
          ? `${formatNumber(
              payload.revokedCount,
            )} نشست یا توکن لغو شد.`
          : 'همه نشست‌های مشتری لغو شدند.';
      }

      setConfirmation(null);
      setStatusReason('');
      setActionsOpen(false);

      setFeedback({
        tone: 'success',
        message,
      });

      await refreshCustomerData();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'عملیات مدیریتی مشتری انجام نشد.',
      });
    } finally {
      setActionPending(false);
    }
  }

  async function submitNote(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const note = noteDraft.note.trim();

    if (!note) {
      setFeedback({
        tone: 'error',
        message: 'متن یادداشت الزامی است.',
      });

      return;
    }

    setNotePending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note,
            visibility: noteDraft.visibility,
            isImportant:
              noteDraft.isImportant,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminCustomerNote>;

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ثبت یادداشت انجام نشد.',
        );
      }

      setNoteDraft(emptyNoteDraft);

      setFeedback({
        tone: 'success',
        message:
          'یادداشت مشتری با موفقیت ثبت شد.',
      });

      await Promise.all([
        loadNotes(),
        loadActivity(),
        loadProfile(),
      ]);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ثبت یادداشت انجام نشد.',
      });
    } finally {
      setNotePending(false);
    }
  }

  async function deleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(
          customerId,
        )}/notes/${encodeURIComponent(
          noteId,
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
            'حذف یادداشت انجام نشد.',
        );
      }

      setFeedback({
        tone: 'success',
        message:
          'یادداشت مشتری حذف شد.',
      });

      await Promise.all([
        loadNotes(),
        loadActivity(),
        loadProfile(),
      ]);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'حذف یادداشت انجام نشد.',
      });
    } finally {
      setDeletingNoteId(null);
    }
  }

  if (loading) {
    return (
      <section className="admin-customer-detail">
        <div className="admin-customer-detail__state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />

          <span>
            در حال دریافت پروفایل مشتری...
          </span>
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="admin-customer-detail">
        <div className="admin-customer-detail__state is-error">
          <AlertTriangle aria-hidden="true" />

          <strong>
            دریافت اطلاعات مشتری ناموفق بود
          </strong>

          <span>
            {feedback?.message ||
              'پروفایل مشتری در دسترس نیست.'}
          </span>

          <div>
            <button
              type="button"
              onClick={() =>
              void Promise.all([
                loadProfile(),
                loadActivity(),
                loadNotes(),
              ])
            }
            >
              <RefreshCcw aria-hidden="true" />
              تلاش مجدد
            </button>

            <Link href="/admin/customers">
              بازگشت به مشتریان
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const { user, segment } = profile;

  const summaryCards = [
    {
      label: 'مجموع خرید',
      value: `${formatMoney(
        user.stats.totalSpent,
      )} تومان`,
      helper: `${formatNumber(
        user.stats.paymentCount,
      )} پرداخت`,
      icon: CircleDollarSign,
    },
    {
      label: 'سفارش‌ها',
      value: formatNumber(
        user.stats.orderCount,
      ),
      helper: `${formatNumber(
        user.stats.completedOrderCount,
      )} تکمیل‌شده`,
      icon: ShoppingBag,
    },
    {
      label: 'آدرس‌ها',
      value: formatNumber(
        user.stats.addressCount,
      ),
      helper: `${formatNumber(
        profile.addresses.length,
      )} آدرس قابل نمایش`,
      icon: MapPin,
    },
    {
      label: 'نشست‌ها',
      value: formatNumber(
        user.stats.sessionCount,
      ),
      helper: `${formatNumber(
        profile.recentSessions.length,
      )} نشست اخیر`,
      icon: LogIn,
    },
    {
      label: 'سطح مشتری',
      value: vipLabels[segment.vipLevel],
      helper:
        segment.segment ||
        'بدون سگمنت اختصاصی',
      icon: Star,
    },
  ];

  return (
    <section className="admin-customer-detail">
      <header className="admin-customer-detail__header">
        <div className="admin-customer-detail__breadcrumb">
          <Link href="/admin/customers">
            <ArrowRight aria-hidden="true" />
            مشتریان
          </Link>

          <span>/</span>

          <strong>
            {customerName(profile)}
          </strong>
        </div>

        <div className="admin-customer-detail__header-actions">
          <button
            type="button"
            onClick={() =>
              void refreshCustomerData()
            }
            disabled={
              loading ||
              actionPending ||
              segmentPending
            }
          >
            <RefreshCcw
              className={
                loading ? 'is-spinning' : ''
              }
              aria-hidden="true"
            />

            بازخوانی
          </button>

          <div className="admin-customer-detail__actions-menu">
            <button
              type="button"
              className="is-primary"
              onClick={() =>
                setActionsOpen(
                  (current) => !current,
                )
              }
              aria-expanded={actionsOpen}
              disabled={actionPending}
            >
              <MoreVertical
                aria-hidden="true"
              />

              عملیات حساب

              <ChevronDown
                aria-hidden="true"
              />
            </button>

            {actionsOpen ? (
              <div role="menu">
                {user.status !== 'ACTIVE' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      setConfirmation({
                        kind: 'status',
                        status: 'ACTIVE',
                        title:
                          'فعال‌سازی حساب',
                        message:
                          'حساب مشتری فعال و امکان ورود مجدد فراهم می‌شود.',
                        confirmLabel:
                          'فعال‌سازی',
                      })
                    }
                  >
                    <ShieldCheck
                      aria-hidden="true"
                    />
                    فعال‌سازی
                  </button>
                ) : null}

                {user.status !== 'INACTIVE' &&
                user.status !== 'DELETED' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      setConfirmation({
                        kind: 'status',
                        status: 'INACTIVE',
                        title:
                          'غیرفعال‌سازی حساب',
                        message:
                          'حساب مشتری غیرفعال می‌شود.',
                        confirmLabel:
                          'غیرفعال‌سازی',
                      })
                    }
                  >
                    <ShieldOff
                      aria-hidden="true"
                    />
                    غیرفعال‌سازی
                  </button>
                ) : null}

                {user.status !== 'SUSPENDED' &&
                user.status !== 'DELETED' ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      setConfirmation({
                        kind: 'status',
                        status: 'SUSPENDED',
                        title:
                          'تعلیق حساب',
                        message:
                          'دسترسی مشتری تا زمان فعال‌سازی مجدد تعلیق می‌شود.',
                        confirmLabel:
                          'تعلیق حساب',
                        danger: true,
                      })
                    }
                  >
                    <LockKeyhole
                      aria-hidden="true"
                    />
                    تعلیق حساب
                  </button>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    setConfirmation({
                      kind:
                        'revoke-sessions',
                      title:
                        'لغو همه نشست‌ها',
                      message:
                        'تمام Sessionها و Refresh Tokenهای مشتری باطل می‌شوند.',
                      confirmLabel:
                        'لغو نشست‌ها',
                      danger: true,
                    })
                  }
                >
                  <LogOut aria-hidden="true" />
                  لغو همه نشست‌ها
                </button>

                {user.status === 'DELETED' ||
                user.deletedAt ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      setConfirmation({
                        kind: 'restore',
                        title:
                          'بازیابی حساب',
                        message:
                          'حساب حذف‌شده مشتری بازیابی می‌شود.',
                        confirmLabel:
                          'بازیابی حساب',
                      })
                    }
                  >
                    <RotateCcw
                      aria-hidden="true"
                    />
                    بازیابی حساب
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    onClick={() =>
                      setConfirmation({
                        kind: 'delete',
                        title:
                          'حذف حساب مشتری',
                        message:
                          'حساب به‌صورت نرم حذف می‌شود و بعداً قابل بازیابی خواهد بود.',
                        confirmLabel:
                          'حذف حساب',
                        danger: true,
                      })
                    }
                  >
                    <Trash2
                      aria-hidden="true"
                    />
                    حذف حساب
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {feedback ? (
        <div
          className={`admin-customer-detail__feedback is-${feedback.tone}`}
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

      <div className="admin-customer-detail__hero">
        <div className="admin-customer-detail__avatar">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
            />
          ) : (
            <span>
              {customerInitials(profile)}
            </span>
          )}
        </div>

        <div className="admin-customer-detail__identity">
          <div>
            <span>پروفایل مشتری</span>

            <h1>{customerName(profile)}</h1>
          </div>

          <div className="admin-customer-detail__badges">
            <span
              className={`admin-customer-detail__status ${statusClass(
                user.status,
              )}`}
            >
              <ShieldCheck aria-hidden="true" />
              {statusLabels[user.status]}
            </span>

            <span className="admin-customer-detail__vip">
              <Star aria-hidden="true" />
              {vipLabels[segment.vipLevel]}
            </span>

            {segment.highRisk ? (
              <span className="admin-customer-detail__risk">
                <AlertTriangle aria-hidden="true" />
                ریسک بالا
              </span>
            ) : null}
          </div>

          {segment.tags.length > 0 ? (
            <div className="admin-customer-detail__tags">
              {segment.tags.map((tag) => (
                <b key={tag}>{tag}</b>
              ))}
            </div>
          ) : null}
        </div>

        <dl className="admin-customer-detail__metadata">
          <div>
            <dt>
              <Phone aria-hidden="true" />
              موبایل
            </dt>

            <dd>
              {user.phone || 'ثبت نشده'}
            </dd>
          </div>

          <div>
            <dt>
              <Mail aria-hidden="true" />
              ایمیل
            </dt>

            <dd>
              {user.email || 'ثبت نشده'}
            </dd>
          </div>

          <div>
            <dt>
              <CalendarDays aria-hidden="true" />
              تاریخ عضویت
            </dt>

            <dd>
              {formatDate(user.createdAt)}
            </dd>
          </div>

          <div>
            <dt>
              <Clock3 aria-hidden="true" />
              آخرین ورود
            </dt>

            <dd>
              {formatDate(
                user.stats.lastLoginAt,
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="admin-customer-detail__metrics">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label}>
              <Icon aria-hidden="true" />

              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.helper}</small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="admin-customer-detail__overview-grid">
        <article>
          <header>
            <div>
              <UserRound aria-hidden="true" />
              <h2>اطلاعات حساب</h2>
            </div>
          </header>

          <dl>
            <div>
              <dt>نام</dt>
              <dd>
                {user.firstName || 'ثبت نشده'}
              </dd>
            </div>

            <div>
              <dt>نام خانوادگی</dt>
              <dd>
                {user.lastName || 'ثبت نشده'}
              </dd>
            </div>

            <div>
              <dt>نقش</dt>
              <dd>
                {user.role?.name ||
                  'بدون نقش مشخص'}
              </dd>
            </div>

            <div>
              <dt>آخرین سفارش</dt>
              <dd>
                {formatDate(
                  user.stats.lastOrderAt,
                )}
              </dd>
            </div>

            <div>
              <dt>سفارش لغوشده</dt>
              <dd>
                {formatNumber(
                  user.stats.cancelledOrderCount,
                )}
              </dd>
            </div>

            <div>
              <dt>نظرهای ثبت‌شده</dt>
              <dd>
                {formatNumber(
                  user.stats.reviewCount,
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article>
          <header>
            <div>
              <CreditCard aria-hidden="true" />
              <h2>وضعیت CRM</h2>
            </div>
          </header>

          <dl>
            <div>
              <dt>سگمنت</dt>
              <dd>
                {segment.segment ||
                  'تعریف نشده'}
              </dd>
            </div>

            <div>
              <dt>سطح VIP</dt>
              <dd>
                {vipLabels[segment.vipLevel]}
              </dd>
            </div>

            <div>
              <dt>اجازه بازاریابی</dt>
              <dd>
                {segment.marketingAllowed ===
                true
                  ? 'مجاز'
                  : segment.marketingAllowed ===
                      false
                    ? 'غیرمجاز'
                    : 'تعیین نشده'}
              </dd>
            </div>

            <div>
              <dt>وضعیت ریسک</dt>
              <dd>
                {segment.highRisk
                  ? 'ریسک بالا'
                  : 'عادی'}
              </dd>
            </div>

            <div>
              <dt>آخرین تغییر سگمنت</dt>
              <dd>
                {formatDate(
                  segment.updatedAt,
                )}
              </dd>
            </div>

            <div>
              <dt>دلیل آخرین تغییر</dt>
              <dd>
                {segment.reason ||
                  'ثبت نشده'}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      {/* ADMIN_CUSTOMER_DETAIL_COMMERCE_V1 */}

      <div className="admin-customer-detail__commerce-grid">
        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <ShoppingBag aria-hidden="true" />

              <div>
                <h2>سفارش‌های اخیر</h2>
                <span>
                  آخرین سفارش‌های ثبت‌شده مشتری
                </span>
              </div>
            </div>

            <b>
              {formatNumber(
                profile.recentOrders.length,
              )}
            </b>
          </header>

          {profile.recentOrders.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <PackageCheck aria-hidden="true" />
              <span>
                سفارشی برای این مشتری ثبت نشده است.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__list">
              {profile.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${encodeURIComponent(
                    order.id,
                  )}`}
                  className="admin-customer-detail__order"
                >
                  <div>
                    <ReceiptText aria-hidden="true" />

                    <div>
                      <strong>
                        سفارش {order.orderNumber}
                      </strong>

                      <span>
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="admin-customer-detail__pill">
                      {orderStatusLabel(
                        order.status,
                      )}
                    </span>

                    <strong>
                      {formatMoney(
                        order.totalAmount,
                      )}
                      {' '}
                      تومان
                    </strong>

                    <ExternalLink aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <WalletCards aria-hidden="true" />

              <div>
                <h2>پرداخت‌های اخیر</h2>
                <span>
                  تراکنش‌های مالی مرتبط با مشتری
                </span>
              </div>
            </div>

            <b>
              {formatNumber(
                profile.recentPayments.length,
              )}
            </b>
          </header>

          {profile.recentPayments.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <CreditCard aria-hidden="true" />
              <span>
                پرداختی برای این مشتری ثبت نشده است.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__list">
              {profile.recentPayments.map(
                (payment) => (
                  <div
                    key={payment.id}
                    className="admin-customer-detail__payment"
                  >
                    <div>
                      <CreditCard aria-hidden="true" />

                      <div>
                        <strong>
                          {paymentMethodLabel(
                            payment.paymentMethod,
                          )}
                        </strong>

                        <span>
                          {formatDate(
                            payment.paidAt ??
                              payment.createdAt,
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="admin-customer-detail__pill">
                        {paymentStatusLabel(
                          payment.paymentStatus,
                        )}
                      </span>

                      <strong>
                        {formatMoney(
                          payment.amount,
                        )}
                        {' '}
                        تومان
                      </strong>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      </div>

      <div className="admin-customer-detail__commerce-grid">
        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <MapPin aria-hidden="true" />

              <div>
                <h2>آدرس‌ها</h2>
                <span>
                  آدرس‌های ثبت‌شده برای ارسال سفارش
                </span>
              </div>
            </div>

            <b>
              {formatNumber(
                profile.addresses.length,
              )}
            </b>
          </header>

          {profile.addresses.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <Truck aria-hidden="true" />
              <span>
                آدرسی برای این مشتری ثبت نشده است.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__address-grid">
              {profile.addresses.map((address) => (
                <section
                  key={address.id}
                  className={
                    address.isDefault
                      ? 'is-default'
                      : undefined
                  }
                >
                  <header>
                    <div>
                      <MapPin aria-hidden="true" />

                      <strong>
                        {address.title ||
                          'آدرس مشتری'}
                      </strong>
                    </div>

                    {address.isDefault ? (
                      <span>پیش‌فرض</span>
                    ) : null}
                  </header>

                  <p>
                    {address.state}، {address.city}،
                    {' '}
                    {address.street}
                    {address.apartment
                      ? `، ${address.apartment}`
                      : ''}
                  </p>

                  <dl>
                    <div>
                      <dt>گیرنده</dt>
                      <dd>{address.fullName}</dd>
                    </div>

                    <div>
                      <dt>موبایل</dt>
                      <dd>{address.phone}</dd>
                    </div>

                    <div>
                      <dt>کد پستی</dt>
                      <dd>{address.postalCode}</dd>
                    </div>
                  </dl>
                </section>
              ))}
            </div>
          )}
        </article>

        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <LogIn aria-hidden="true" />

              <div>
                <h2>نشست‌های اخیر</h2>
                <span>
                  دستگاه‌ها و ورودهای اخیر مشتری
                </span>
              </div>
            </div>

            <b>
              {formatNumber(
                profile.recentSessions.length,
              )}
            </b>
          </header>

          {profile.recentSessions.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <Globe2 aria-hidden="true" />
              <span>
                نشست فعالی برای مشتری وجود ندارد.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__list">
              {profile.recentSessions.map(
                (session) => {
                  const DeviceIcon = deviceIcon(
                    session.userAgent,
                  );

                  return (
                    <div
                      key={session.id}
                      className="admin-customer-detail__session"
                    >
                      <div>
                        <DeviceIcon aria-hidden="true" />

                        <div>
                          <strong>
                            {session.userAgent ||
                              'دستگاه ناشناس'}
                          </strong>

                          <span>
                            IP:
                            {' '}
                            {session.ipAddress ||
                              'ثبت نشده'}
                          </span>
                        </div>
                      </div>

                      <dl>
                        <div>
                          <dt>شروع نشست</dt>
                          <dd>
                            {formatDate(
                              session.createdAt,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>انقضا</dt>
                          <dd>
                            {formatDate(
                              session.expiresAt,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </article>
      </div>

      <article className="admin-customer-detail__panel admin-customer-detail__segment-editor">
        <header>
          <div>
            <Star aria-hidden="true" />

            <div>
              <h2>مدیریت CRM و سگمنت</h2>
              <span>
                سطح VIP، برچسب‌ها، بازاریابی و
                کنترل ریسک
              </span>
            </div>
          </div>
        </header>

        <form onSubmit={submitSegment}>
          <div className="admin-customer-detail__segment-grid">
            <label>
              <span>نام سگمنت</span>

              <input
                value={segmentDraft.segment}
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      segment:
                        event.target.value,
                    }),
                  )
                }
                maxLength={100}
                placeholder="مثلاً مشتریان وفادار"
                disabled={segmentPending}
              />
            </label>

            <label>
              <span>سطح VIP</span>

              <select
                value={segmentDraft.vipLevel}
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      vipLevel:
                        event.target
                          .value as AdminCustomerVipLevel,
                    }),
                  )
                }
                disabled={segmentPending}
              >
                <option value="none">
                  بدون سطح
                </option>
                <option value="bronze">
                  برنزی
                </option>
                <option value="silver">
                  نقره‌ای
                </option>
                <option value="gold">
                  طلایی
                </option>
                <option value="platinum">
                  پلاتینیوم
                </option>
              </select>
            </label>

            <label>
              <span>
                برچسب‌ها؛ جداشده با کاما
              </span>

              <input
                value={segmentDraft.tags}
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      tags: event.target.value,
                    }),
                  )
                }
                placeholder="vip, returning, wholesale"
                disabled={segmentPending}
              />
            </label>

            <label>
              <span>اجازه بازاریابی</span>

              <select
                value={
                  segmentDraft.marketingAllowed
                }
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      marketingAllowed:
                        event.target
                          .value as
                          | ''
                          | 'true'
                          | 'false',
                    }),
                  )
                }
                disabled={segmentPending}
              >
                <option value="">
                  تعیین نشده
                </option>
                <option value="true">
                  مجاز
                </option>
                <option value="false">
                  غیرمجاز
                </option>
              </select>
            </label>

            <label className="admin-customer-detail__risk-control">
              <input
                type="checkbox"
                checked={segmentDraft.highRisk}
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      highRisk:
                        event.target.checked,
                    }),
                  )
                }
                disabled={segmentPending}
              />

              <span>
                این مشتری دارای ریسک بالا است
              </span>
            </label>

            <label className="is-wide">
              <span>دلیل تغییر</span>

              <textarea
                value={segmentDraft.reason}
                onChange={(event) =>
                  setSegmentDraft(
                    (current) => ({
                      ...current,
                      reason:
                        event.target.value,
                    }),
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="دلیل تغییر سگمنت یا سطح ریسک..."
                disabled={segmentPending}
              />
            </label>
          </div>

          <footer>
            <button
              type="submit"
              disabled={segmentPending}
            >
              {segmentPending ? (
                <LoaderCircle
                  className="is-spinning"
                  aria-hidden="true"
                />
              ) : (
                <Save aria-hidden="true" />
              )}

              ذخیره تنظیمات CRM
            </button>
          </footer>
        </form>
      </article>

      <div className="admin-customer-detail__crm-grid">
        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <Activity aria-hidden="true" />

              <div>
                <h2>تایم‌لاین فعالیت‌ها</h2>
                <span>
                  سفارش‌ها، پرداخت‌ها، نشست‌ها و
                  رویدادهای مشتری
                </span>
              </div>
            </div>

            <b>
              {formatNumber(activities.length)}
            </b>
          </header>

          {activityLoading ? (
            <div className="admin-customer-detail__empty">
              <LoaderCircle
                className="is-spinning"
                aria-hidden="true"
              />

              <span>
                در حال دریافت فعالیت‌ها...
              </span>
            </div>
          ) : activities.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <Activity aria-hidden="true" />

              <span>
                فعالیتی برای این مشتری ثبت نشده است.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__timeline">
              {activities.map((item) => {
                const ActivityIcon =
                  activityIcon(item.source);

                return (
                  <section
                    key={`${item.source}-${item.id}`}
                  >
                    <div className="admin-customer-detail__timeline-icon">
                      <ActivityIcon
                        aria-hidden="true"
                      />
                    </div>

                    <div className="admin-customer-detail__timeline-content">
                      <header>
                        <div>
                          <strong>
                            {item.title}
                          </strong>

                          <span>
                            {activitySourceLabel(
                              item.source,
                            )}
                          </span>
                        </div>

                        <time
                          dateTime={
                            item.occurredAt
                          }
                        >
                          {formatDate(
                            item.occurredAt,
                          )}
                        </time>
                      </header>

                      {item.description ? (
                        <p>
                          {item.description}
                        </p>
                      ) : null}

                      <footer>
                        {item.status ? (
                          <span>
                            {item.status}
                          </span>
                        ) : null}

                        {item.amount !== null ? (
                          <strong>
                            {formatMoney(
                              item.amount,
                            )}
                            {' '}
                            تومان
                          </strong>
                        ) : null}
                      </footer>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </article>

        <article className="admin-customer-detail__panel">
          <header>
            <div>
              <FileText aria-hidden="true" />

              <div>
                <h2>یادداشت‌های مدیریتی</h2>
                <span>
                  اطلاعات داخلی تیم درباره مشتری
                </span>
              </div>
            </div>

            <b>{formatNumber(notes.length)}</b>
          </header>

          <form
            className="admin-customer-detail__note-form"
            onSubmit={submitNote}
          >
            <label>
              <span>متن یادداشت</span>

              <textarea
                value={noteDraft.note}
                onChange={(event) =>
                  setNoteDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                rows={4}
                maxLength={2000}
                placeholder="یادداشت داخلی درباره مشتری..."
                disabled={notePending}
                required
              />
            </label>

            <div>
              <label>
                <span>سطح نمایش</span>

                <select
                  value={noteDraft.visibility}
                  onChange={(event) =>
                    setNoteDraft((current) => ({
                      ...current,
                      visibility:
                        event.target
                          .value as AdminCustomerNoteVisibility,
                    }))
                  }
                  disabled={notePending}
                >
                  <option value="admin">
                    مدیریت
                  </option>
                  <option value="support">
                    پشتیبانی
                  </option>
                  <option value="finance">
                    مالی
                  </option>
                  <option value="private">
                    خصوصی
                  </option>
                </select>
              </label>

              <label className="admin-customer-detail__note-important">
                <input
                  type="checkbox"
                  checked={
                    noteDraft.isImportant
                  }
                  onChange={(event) =>
                    setNoteDraft((current) => ({
                      ...current,
                      isImportant:
                        event.target.checked,
                    }))
                  }
                  disabled={notePending}
                />

                <span>یادداشت مهم</span>
              </label>

              <button
                type="submit"
                disabled={
                  notePending ||
                  !noteDraft.note.trim()
                }
              >
                {notePending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <Save aria-hidden="true" />
                )}

                ثبت یادداشت
              </button>
            </div>
          </form>

          {notesLoading ? (
            <div className="admin-customer-detail__empty">
              <LoaderCircle
                className="is-spinning"
                aria-hidden="true"
              />

              <span>
                در حال دریافت یادداشت‌ها...
              </span>
            </div>
          ) : notes.length === 0 ? (
            <div className="admin-customer-detail__empty">
              <FileText aria-hidden="true" />

              <span>
                هنوز یادداشتی ثبت نشده است.
              </span>
            </div>
          ) : (
            <div className="admin-customer-detail__notes">
              {notes.map((note) => (
                <section
                  key={note.id}
                  className={
                    note.isImportant
                      ? 'is-important'
                      : undefined
                  }
                >
                  <header>
                    <div>
                      {note.isImportant ? (
                        <Star
                          aria-hidden="true"
                        />
                      ) : (
                        <FileText
                          aria-hidden="true"
                        />
                      )}

                      <span>
                        {
                          visibilityLabels[
                            note.visibility
                          ]
                        }
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void deleteNote(note.id)
                      }
                      disabled={
                        deletingNoteId === note.id
                      }
                      aria-label="حذف یادداشت"
                    >
                      {deletingNoteId ===
                      note.id ? (
                        <LoaderCircle
                          className="is-spinning"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </header>

                  <p>
                    {note.note ||
                      'متن یادداشت در دسترس نیست.'}
                  </p>

                  <footer>
                    <time
                      dateTime={note.createdAt}
                    >
                      {formatDate(note.createdAt)}
                    </time>

                    {note.actorId ? (
                      <span>
                        ثبت‌کننده:
                        {' '}
                        {note.actorId}
                      </span>
                    ) : null}
                  </footer>
                </section>
              ))}
            </div>
          )}
        </article>
      </div>

      {confirmation ? (
        <div
          className="admin-customer-detail__overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionPending
            ) {
              setConfirmation(null);
              setStatusReason('');
            }
          }}
        >
          <section
            className={`admin-customer-detail__confirm${
  'danger' in confirmation && confirmation.danger
    ? ' is-danger'
    : ''
}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="customer-confirm-title"
          >
            <header>
              <div>
                {'danger' in confirmation && confirmation.danger ? (
                  <AlertTriangle
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck
                    aria-hidden="true"
                  />
                )}

                <h2 id="customer-confirm-title">
                  {confirmation.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setStatusReason('');
                }}
                disabled={actionPending}
                aria-label="بستن"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <p>{confirmation.message}</p>

            {confirmation.kind ===
            'status' ? (
              <label>
                <span>
                  دلیل تغییر وضعیت — اختیاری
                </span>

                <textarea
                  value={statusReason}
                  onChange={(event) =>
                    setStatusReason(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={3}
                  disabled={actionPending}
                />
              </label>
            ) : null}

            <footer>
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  setStatusReason('');
                }}
                disabled={actionPending}
              >
                انصراف
              </button>

              <button
                type="button"
               className={
  'danger' in confirmation &&
  confirmation.danger
    ? 'is-danger'
    : 'is-primary'
}
                onClick={() =>
                  void executeCustomerAction()
                }
                disabled={actionPending}
              >
                {actionPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : 'danger' in confirmation &&
  confirmation.danger ? (
                  <AlertTriangle
                    aria-hidden="true"
                  />
                ) : (
                  <Check aria-hidden="true" />
                )}

                {confirmation.confirmLabel}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
