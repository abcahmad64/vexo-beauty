'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ImageOff,
  LoaderCircle,
  Package,
  RefreshCcw,
  Search,
  SlidersHorizontal,
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
  AdminProductListItem,
  AdminProductListMeta,
  AdminProductListPayload,
} from '@/types/admin';

const statusOptions = [
  ['', 'همه وضعیت‌ها'],
  ['DRAFT', 'پیش‌نویس'],
  ['ACTIVE', 'فعال'],
  ['INACTIVE', 'غیرفعال'],
  ['ARCHIVED', 'بایگانی‌شده'],
] as const;

const activityOptions = [
  ['', 'همه محصولات'],
  ['true', 'فقط فعال‌ها'],
  ['false', 'فقط غیرفعال‌ها'],
] as const;

const sortOptions = [
  ['createdAt:desc', 'جدیدترین'],
  ['updatedAt:desc', 'آخرین ویرایش'],
  ['name:asc', 'نام؛ صعودی'],
  ['name:desc', 'نام؛ نزولی'],
  ['finalPrice:asc', 'قیمت؛ کم به زیاد'],
  ['finalPrice:desc', 'قیمت؛ زیاد به کم'],
  ['viewCount:desc', 'پربازدیدترین'],
  ['averageRating:desc', 'بالاترین امتیاز'],
] as const;

const statusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  ARCHIVED: 'بایگانی‌شده',
};

function formatMoney(
  value: string | number | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value);
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

function finalProductPrice(product: AdminProductListItem) {
  return (
    product.pricing.finalPrice ??
    product.pricing.salePrice ??
    product.price
  );
}

function stockLabel(product: AdminProductListItem) {
  if (product.stock.isOutOfStock) {
    return 'ناموجود';
  }

  if (product.stock.isLowStock) {
    return 'رو به اتمام';
  }

  return 'موجود';
}

export function AdminProductsScreen() {
  const [products, setProducts] = useState<
    AdminProductListItem[]
  >([]);

  const [meta, setMeta] =
    useState<AdminProductListMeta>({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [status, setStatus] = useState('');
  const [isActive, setIsActive] = useState('');
  const [hasDiscount, setHasDiscount] =
    useState(false);
  const [missingSeo, setMissingSeo] =
    useState(false);

  const [sort, setSort] =
    useState('createdAt:desc');

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [message, setMessage] =
    useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
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

      if (isActive) {
        params.set('isActive', isActive);
      }

      if (hasDiscount) {
        params.set('hasDiscount', 'true');
      }

      if (missingSeo) {
        params.set('missingSeo', 'true');
      }

      const response = await fetch(
        `/api/admin/products?${params.toString()}`,
        {
          cache: 'no-store',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminProductListPayload>;

      if (response.status === 401) {
        window.location.href =
          '/admin/login?next=%2Fadmin%2Fproducts';
        return;
      }

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت محصولات انجام نشد.',
        );
      }

      const payload = envelope.data;

      setProducts(
        Array.isArray(payload.data)
          ? payload.data
          : [],
      );

      setMeta({
        page: Number(payload.meta?.page ?? page),
        limit: Number(payload.meta?.limit ?? 20),
        total: Number(payload.meta?.total ?? 0),
        totalPages: Math.max(
          1,
          Number(payload.meta?.totalPages ?? 1),
        ),
      });
    } catch (error) {
      setProducts([]);

      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت محصولات انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    hasDiscount,
    isActive,
    missingSeo,
    page,
    sort,
    status,
    submittedQuery,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProducts]);

  const metrics = useMemo(() => {
    const active = products.filter(
      (product) =>
        product.status === 'ACTIVE' &&
        product.isActive,
    ).length;

    const lowStock = products.filter(
      (product) => product.stock.isLowStock,
    ).length;

    const outOfStock = products.filter(
      (product) => product.stock.isOutOfStock,
    ).length;

    return [
      {
        label: 'کل نتایج',
        value: meta.total,
        icon: Package,
      },
      {
        label: 'فعال در صفحه',
        value: active,
        icon: CircleCheck,
      },
      {
        label: 'کم‌موجودی در صفحه',
        value: lowStock,
        icon: AlertTriangle,
      },
      {
        label: 'ناموجود در صفحه',
        value: outOfStock,
        icon: Boxes,
      },
    ];
  }, [meta.total, products]);

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
    setIsActive('');
    setHasDiscount(false);
    setMissingSeo(false);
    setSort('createdAt:desc');
    setPage(1);
  }

  return (
    <main className="admin-page">
      <AdminHeader
        title="مدیریت محصولات"
        subtitle="کاتالوگ، قیمت‌گذاری، انتشار و وضعیت موجودی محصولات"
        onRefresh={loadProducts}
        refreshing={loading}
      />

      <section className="admin-product-metrics">
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
                  {formatNumber(metric.value)}
                </strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-products-toolbar">
        <form onSubmit={submitSearch}>
          <div className="admin-products-search">
            <Search aria-hidden="true" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="نام، SKU، اسلاگ یا مشخصات محصول"
            />

            <button
              type="submit"
              disabled={loading}
            >
              جستجو
            </button>
          </div>
        </form>

        <div className="admin-products-filters">
          <SlidersHorizontal aria-hidden="true" />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value);
              setPage(1);
            }}
          >
            {activityOptions.map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            {sortOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              checked={hasDiscount}
              onChange={(event) => {
                setHasDiscount(
                  event.target.checked,
                );
                setPage(1);
              }}
            />
            <BadgePercent aria-hidden="true" />
            تخفیف‌دار
          </label>

          <label>
            <input
              type="checkbox"
              checked={missingSeo}
              onChange={(event) => {
                setMissingSeo(
                  event.target.checked,
                );
                setPage(1);
              }}
            />
            <Sparkles aria-hidden="true" />
            SEO ناقص
          </label>

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
        <p className="admin-message" role="alert">
          {message}
        </p>
      ) : null}

      <section className="admin-products-panel">
        <header>
          <div>
            <span className="panel-label">
              PRODUCTS
            </span>
            <h2>فهرست محصولات</h2>
          </div>

          <span>
            صفحه {formatNumber(meta.page)}
            {' '}از{' '}
            {formatNumber(meta.totalPages)}
          </span>
        </header>

        {loading && products.length === 0 ? (
          <div className="admin-products-state">
            <LoaderCircle
              className="is-spinning"
              aria-hidden="true"
            />
            <p>در حال دریافت محصولات...</p>
          </div>
        ) : null}

        {!loading && products.length === 0 ? (
          <div className="admin-products-state">
            <Package aria-hidden="true" />
            <h3>محصولی یافت نشد</h3>
            <p>
              عبارت جستجو یا فیلترهای انتخاب‌شده را
              تغییر دهید.
            </p>
          </div>
        ) : null}

        {products.length > 0 ? (
          <div className="admin-products-table-wrap">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>محصول</th>
                  <th>برند و دسته</th>
                  <th>قیمت</th>
                  <th>موجودی</th>
                  <th>وضعیت</th>
                  <th>AI</th>
                  <th>آخرین تغییر</th>
                  <th aria-label="عملیات" />
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-product-primary">
                        <span className="admin-product-thumb">
                          {product.primaryImage.url ? (
                            <Image
                              src={product.primaryImage.url}
                              alt={
                                product.primaryImage.altText ||
                                product.name
                              }
                              width={56}
                              height={56}
                              sizes="56px"
                              unoptimized
                            />
                          ) : (
                            <ImageOff
                              aria-hidden="true"
                            />
                          )}
                        </span>

                        <div>
                          <strong>{product.name}</strong>

                          <small>
                            SKU:
                            {' '}
                            <bdi dir="ltr">
                              {product.sku}
                            </bdi>
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="admin-product-taxonomy">
                        <strong>
                          {product.brand.name ||
                            'برند ثبت نشده'}
                        </strong>
                        <small>
                          {product.category.name ||
                            'دسته ثبت نشده'}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="admin-product-pricing">
                        <strong>
                          {formatMoney(
                            finalProductPrice(product),
                          )}
                          {' '}
                          ریال
                        </strong>

                        {product.pricing.discountPercent ? (
                          <small>
                            {product.pricing.discountPercent}
                            ٪ تخفیف
                          </small>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <div className="admin-product-stock">
                        <span
                          className={
                            product.stock.isOutOfStock
                              ? 'is-out'
                              : product.stock.isLowStock
                                ? 'is-low'
                                : 'is-ready'
                          }
                        >
                          {stockLabel(product)}
                        </span>

                        <small>
                          {formatNumber(
                            product.stock.availableStock,
                          )}
                          {' '}
                          قابل فروش
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="admin-product-status-cell">
                        <span
                          className={`admin-product-status is-${product.status.toLowerCase()}`}
                        >
                          {statusLabels[product.status] ||
                            product.status}
                        </span>

                        {!product.isActive ? (
                          <small>غیرفعال</small>
                        ) : null}
                      </div>
                    </td>

                    <td>
                      <div className="admin-product-ai">
                        <Sparkles aria-hidden="true" />

                        <div>
                          <strong>
                            {product.ai.contentStatus}
                          </strong>
                          <small>
                            امتیاز:
                            {' '}
                            {product.ai.qualityScore ??
                              '—'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <time>
                        {formatDate(product.updatedAt)}
                      </time>
                    </td>

                    <td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        aria-label={`مشاهده محصول ${product.name}`}
                      >
                        جزئیات
                        <ArrowLeft aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {products.length > 0 ? (
          <footer className="admin-products-pagination">
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
              <ChevronRight aria-hidden="true" />
              صفحه قبل
            </button>

            <span>
              {formatNumber(meta.total)}
              {' '}
              محصول
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
              <ChevronLeft aria-hidden="true" />
            </button>
          </footer>
        ) : null}
      </section>

      <button
        type="button"
        className="admin-products-floating-refresh"
        onClick={loadProducts}
        disabled={loading}
        aria-label="به‌روزرسانی محصولات"
      >
        <RefreshCcw
          className={loading ? 'is-spinning' : ''}
          aria-hidden="true"
        />
      </button>
    </main>
  );
}
