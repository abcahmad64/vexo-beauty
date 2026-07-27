import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  PackageOpen,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import type {
  CatalogPageData,
  StorefrontProduct,
} from '@/types/storefront';

import { ProductGrid } from './product-grid';

type SearchValue =
  | string
  | string[]
  | undefined;

type SearchValues = Record<string, SearchValue>;

type CatalogPageProps = {
  data: CatalogPageData | null;
  searchParams: SearchValues;
  mode: 'catalog' | 'search';
};

function firstValue(value: SearchValue): string {
  return Array.isArray(value)
    ? value[0] ?? ''
    : value ?? '';
}

function productsFromData(
  data: CatalogPageData | null,
): StorefrontProduct[] {
  if (!data) {
    return [];
  }

  if (Array.isArray(data.sections?.products)) {
    return data.sections.products;
  }

  if (Array.isArray(data.products)) {
    return data.products;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.sections?.productSections)) {
    return data.sections.productSections.flatMap(
      (section) => section.products,
    );
  }

  return [];
}

function buildHref(
  pathname: string,
  current: SearchValues,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams();

  Object.entries(current).forEach(([key, value]) => {
    const normalized = firstValue(value);

    if (normalized) {
      params.set(key, normalized);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === '') {
      params.delete(key);
      return;
    }

    params.set(key, value);
  });

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function CatalogPage({
  data,
  searchParams,
  mode,
}: CatalogPageProps) {
  const products = productsFromData(data);
  const facets = data?.sections?.facets;
  const pagination = data?.sections?.pagination;
  const sortOptions = data?.sections?.sortOptions ?? [];
  const emptyState = data?.sections?.emptyState;

  const query =
    firstValue(searchParams.q) ||
    data?.query?.q ||
    '';

  const pathname =
    mode === 'search'
      ? '/products/search'
      : '/products';

  const title =
    data?.hero?.title ??
    (
      mode === 'search'
        ? query
          ? `نتایج جست‌وجوی «${query}»`
          : 'جست‌وجوی محصولات'
        : 'محصولات وکسو بیوتی'
    );

  const subtitle =
    data?.hero?.subtitle ??
    (
      products.length > 0
        ? `${new Intl.NumberFormat('fa-IR').format(
            pagination?.total ?? products.length,
          )} محصول برای مشاهده آماده است.`
        : null
    );

  return (
    <main className="catalog-page">
      <nav
        className="catalog-breadcrumbs"
        aria-label="مسیر صفحه"
      >
        <Link href="/">
          خانه
        </Link>

        <ChevronLeft aria-hidden="true" />

        <Link href="/products">
          محصولات
        </Link>

        {mode === 'search' ? (
          <>
            <ChevronLeft aria-hidden="true" />
            <span>جست‌وجو</span>
          </>
        ) : null}
      </nav>

      <section className="catalog-hero">
        <div>
          <span className="panel-label">
            کاتالوگ واقعی فروشگاه
          </span>

          <h1>{title}</h1>

          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <form
          action="/products/search"
          method="get"
          className="catalog-search"
        >
          <Search aria-hidden="true" />

          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="نام محصول، برند یا دسته‌بندی..."
            aria-label="جست‌وجوی محصولات"
          />

          <button type="submit">
            جست‌وجو
            <ArrowLeft aria-hidden="true" />
          </button>
        </form>
      </section>

      <div className="catalog-layout">
        <aside
          className="catalog-filters"
          aria-label="فیلتر محصولات"
        >
          <header>
            <Filter aria-hidden="true" />
            <strong>فیلترها</strong>

            <Link
              href={
                mode === 'search' && query
                  ? `/products/search?q=${encodeURIComponent(query)}`
                  : pathname
              }
            >
              پاک‌کردن
            </Link>
          </header>

          {facets?.categories?.length ? (
            <section>
              <h2>دسته‌بندی</h2>

              <div className="catalog-filter-list">
                {facets.categories.map((item) => (
                  <Link
                    key={item.slug}
                    href={buildHref(
                      pathname,
                      searchParams,
                      {
                        categorySlug: item.slug,
                        page: '1',
                      },
                    )}
                  >
                    <span>{item.name}</span>
                    <small>
                      {new Intl.NumberFormat('fa-IR').format(
                        item.count,
                      )}
                    </small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {facets?.brands?.length ? (
            <section>
              <h2>برند</h2>

              <div className="catalog-filter-list">
                {facets.brands.map((item) => (
                  <Link
                    key={item.slug}
                    href={buildHref(
                      pathname,
                      searchParams,
                      {
                        brandSlug: item.slug,
                        page: '1',
                      },
                    )}
                  >
                    <span>{item.name}</span>
                    <small>
                      {new Intl.NumberFormat('fa-IR').format(
                        item.count,
                      )}
                    </small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {facets ? (
            <section>
              <h2>وضعیت محصول</h2>

              <div className="catalog-filter-list">
                {facets.availability.inStock > 0 ? (
                  <Link
                    href={buildHref(
                      pathname,
                      searchParams,
                      {
                        inStock: 'true',
                        page: '1',
                      },
                    )}
                  >
                    <span>فقط محصولات موجود</span>
                    <small>
                      {new Intl.NumberFormat('fa-IR').format(
                        facets.availability.inStock,
                      )}
                    </small>
                  </Link>
                ) : null}

                {facets.discounts.discounted > 0 ? (
                  <Link
                    href={buildHref(
                      pathname,
                      searchParams,
                      {
                        hasDiscount: 'true',
                        page: '1',
                      },
                    )}
                  >
                    <span>دارای تخفیف</span>
                    <small>
                      {new Intl.NumberFormat('fa-IR').format(
                        facets.discounts.discounted,
                      )}
                    </small>
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="catalog-results">
          <header className="catalog-results__toolbar">
            <div>
              <SlidersHorizontal aria-hidden="true" />

              <strong>
                {new Intl.NumberFormat('fa-IR').format(
                  pagination?.total ?? products.length,
                )}{' '}
                محصول
              </strong>
            </div>

            {sortOptions.length > 0 ? (
              <form
                action={pathname}
                method="get"
                className="catalog-sort"
              >
                {Object.entries(searchParams).map(([key, value]) => {
                  if (
                    key === 'sort' ||
                    !firstValue(value)
                  ) {
                    return null;
                  }

                  return (
                    <input
                      key={key}
                      type="hidden"
                      name={key}
                      value={firstValue(value)}
                    />
                  );
                })}

                <label htmlFor="catalog-sort">
                  مرتب‌سازی
                </label>

                <select
                  id="catalog-sort"
                  name="sort"
                  defaultValue={
                    firstValue(searchParams.sort) ||
                    data?.query?.sort ||
                    'newest'
                  }
                >
                  {sortOptions.map((option) => (
                    <option
                      key={option.key}
                      value={option.key}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <button type="submit">
                  اعمال
                </button>
              </form>
            ) : null}
          </header>

          {products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            <div className="catalog-empty-state">
              <PackageOpen aria-hidden="true" />

              <h2>
                {emptyState?.title ??
                  'محصولی برای نمایش پیدا نشد.'}
              </h2>

              <p>
                {emptyState?.description ??
                  'عبارت جست‌وجو یا فیلترهای انتخاب‌شده را تغییر دهید.'}
              </p>

              <Link
                href="/products"
                className="button button--primary"
              >
                مشاهدهٔ همهٔ محصولات
                <ArrowLeft aria-hidden="true" />
              </Link>
            </div>
          )}

          {pagination && pagination.totalPages > 1 ? (
            <nav
              className="catalog-pagination"
              aria-label="صفحه‌بندی محصولات"
            >
              {pagination.hasPrevious ? (
                <Link
                  href={buildHref(
                    pathname,
                    searchParams,
                    {
                      page: String(pagination.page - 1),
                    },
                  )}
                >
                  <ChevronRight aria-hidden="true" />
                  قبلی
                </Link>
              ) : (
                <span />
              )}

              <strong>
                صفحه{' '}
                {new Intl.NumberFormat('fa-IR').format(
                  pagination.page,
                )}{' '}
                از{' '}
                {new Intl.NumberFormat('fa-IR').format(
                  pagination.totalPages,
                )}
              </strong>

              {pagination.hasNext ? (
                <Link
                  href={buildHref(
                    pathname,
                    searchParams,
                    {
                      page: String(pagination.page + 1),
                    },
                  )}
                >
                  بعدی
                  <ChevronLeft aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
