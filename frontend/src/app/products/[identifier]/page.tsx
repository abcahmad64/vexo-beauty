import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleAlert,
  ImageIcon,
  PackageCheck,
  PackageX,
  Sparkles,
} from 'lucide-react';

import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { ProductGrid } from '@/components/catalog/product-grid';
import { getProductPageData } from '@/lib/api/storefront';

import type {
  ProductImage,
  ProductMoneyValue,
} from '@/types/storefront';

type ProductPageProps = {
  params: Promise<{
    identifier: string;
  }>;
};

export const dynamic = 'force-dynamic';

function toNumber(
  value: ProductMoneyValue | null | undefined,
): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function formatMoney(
  value: ProductMoneyValue | null | undefined,
): string {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function imageAlt(
  image: ProductImage,
  fallback: string,
): string {
  return (
    image.altText ??
    image.alt ??
    image.title ??
    fallback
  );
}

export default async function ProductPage({
  params,
}: ProductPageProps) {
  const { identifier } = await params;
  const data = await getProductPageData(identifier);

  if (!data?.product) {
    notFound();
  }

  const product = data.product;

  const pricing =
    data.commercial?.pricing ??
    product.pricing;

  const stock =
    data.commercial?.stock ??
    product.stock;

  const images = [
    ...(product.media?.images ?? []),
  ]
    .filter(
      (image) =>
        image.isActive !== false &&
        Boolean(image.url),
    )
    .sort(
      (first, second) =>
        (first.sortOrder ?? 0) -
        (second.sortOrder ?? 0),
    );

  const primaryImage =
    product.media?.primaryImage ??
    images.find((image) => image.isPrimary) ??
    images[0] ??
    null;

  const secondaryImages = images.filter(
    (image) => image.url !== primaryImage?.url,
  );

  const comparePrice =
    pricing.comparePrice ??
    pricing.originalPrice ??
    null;

  const hasDiscount =
    pricing.hasDiscount === true ||
    toNumber(comparePrice) >
      toNumber(pricing.displayPrice);

  const highlights =
    data.sections?.highlights ?? [];

  const faq =
    data.sections?.faq ??
    product.content?.faq ??
    [];

  const related =
    data.sections?.related ?? [];

  const badges =
    data.sections?.badges ?? [];

  const decision =
    data.sections?.purchaseGuide?.decision ??
    data.commercial?.decision ??
    null;

  return (
    <main className="product-detail-page">
      <nav
        className="product-detail-page__breadcrumbs"
        aria-label="مسیر صفحه"
      >
        <Link href="/">خانه</Link>
        <ArrowLeft aria-hidden="true" />
        <Link href="/products">محصولات</Link>

        {product.category?.slug &&
        product.category.name ? (
          <>
            <ArrowLeft aria-hidden="true" />
            <Link
              href={`/products/category/${product.category.slug}`}
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <section className="product-detail-hero">
        <div className="product-gallery">
          <div className="product-gallery__primary">
            {primaryImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage.url}
                alt={imageAlt(
                  primaryImage,
                  product.name,
                )}
              />
            ) : (
              <span className="product-gallery__empty">
                <ImageIcon aria-hidden="true" />
              </span>
            )}
          </div>

          {secondaryImages.length > 0 ? (
            <div
              className="product-gallery__thumbnails"
              aria-label="تصاویر دیگر محصول"
            >
              {secondaryImages.map((image, index) => (
                <div
                  key={
                    image.id ??
                    image.url ??
                    String(index)
                  }
                  className="product-gallery__thumbnail"
                >
                  {image.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.thumbnailUrl ?? image.url}
                      alt={imageAlt(
                        image,
                        `${product.name}، نمای ${index + 2}`,
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-detail-summary">
          <div className="product-detail-summary__labels">
            {product.brand?.name ? (
              <Link
                href={
                  product.brand.slug
                    ? `/products/brand/${product.brand.slug}`
                    : '/products'
                }
                className="panel-label"
              >
                {product.brand.name}
              </Link>
            ) : null}

            {badges.map((badge) => (
              <span
                key={badge}
                className="product-detail-badge"
              >
                {badge}
              </span>
            ))}
          </div>

          <h1>{product.name}</h1>

          {product.shortDescription ? (
            <p className="product-detail-summary__lead">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="product-detail-price">
            {hasDiscount && comparePrice ? (
              <del>
                {formatMoney(comparePrice)} ریال
              </del>
            ) : null}

            <strong>
              {formatMoney(pricing.displayPrice)}
              <small> ریال</small>
            </strong>
          </div>

          <div
            className={
              stock.inStock
                ? 'product-detail-stock is-available'
                : 'product-detail-stock'
            }
          >
            {stock.inStock ? (
              <PackageCheck aria-hidden="true" />
            ) : (
              <PackageX aria-hidden="true" />
            )}

            <span>
              {stock.inStock
                ? 'موجود و آمادهٔ خرید'
                : 'در حال حاضر ناموجود'}
            </span>

            {stock.inStock &&
            typeof stock.availableStock === 'number' ? (
              <small>
                موجودی قابل فروش:{' '}
                {new Intl.NumberFormat('fa-IR').format(
                  stock.availableStock,
                )}{' '}
                عدد
              </small>
            ) : null}
          </div>

          {product.description ? (
            <p className="product-detail-summary__description">
              {product.description}
            </p>
          ) : null}

          <div className="product-detail-actions">
            <AddToCartButton
              productId={product.id}
              disabled={!stock.inStock}
              maxQuantity={stock.availableStock}
            />

            <Link
              href={`/beauty-assistant?product=${encodeURIComponent(
                product.slug,
              )}`}
              className="button button--secondary"
            >
              <Sparkles aria-hidden="true" />
              مشاوره هوشمند خرید
            </Link>
          </div>

          {product.sku ? (
            <dl className="product-detail-meta">
              <div>
                <dt>کد محصول</dt>
                <dd>{product.sku}</dd>
              </div>

              {product.category?.name ? (
                <div>
                  <dt>دسته‌بندی</dt>
                  <dd>{product.category.name}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </section>

      {highlights.length > 0 ? (
        <section
          className="product-detail-section"
          aria-labelledby="product-highlights-title"
        >
          <header>
            <span className="panel-label">
              اطلاعات عمومی محصول
            </span>
            <h2 id="product-highlights-title">
              نکات مهم پیش از خرید
            </h2>
          </header>

          <div className="product-highlights-grid">
            {highlights.map((highlight) => (
              <article key={highlight.key ?? highlight.title}>
                <BadgeCheck aria-hidden="true" />
                <h3>{highlight.title}</h3>
                <p>{highlight.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {decision ? (
        <section className="product-decision-panel">
          <div>
            <span className="panel-label">
              راهنمای تصمیم خرید
            </span>

            <h2>
              {decision.label ??
                'بررسی اطلاعات پیش از خرید'}
            </h2>

            {decision.recommendation ? (
              <p>{decision.recommendation}</p>
            ) : null}
          </div>

          <div className="product-decision-panel__details">
            {decision.reasons?.length ? (
              <ul>
                {decision.reasons.map((reason) => (
                  <li key={reason}>
                    <Check aria-hidden="true" />
                    {reason}
                  </li>
                ))}
              </ul>
            ) : null}

            {decision.cautions?.length ? (
              <ul className="is-caution">
                {decision.cautions.map((caution) => (
                  <li key={caution}>
                    <CircleAlert aria-hidden="true" />
                    {caution}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {faq.length > 0 ? (
        <section
          className="product-detail-section"
          aria-labelledby="product-faq-title"
        >
          <header>
            <span className="panel-label">
              پرسش‌های متداول
            </span>
            <h2 id="product-faq-title">
              پاسخ‌های مبتنی بر اطلاعات محصول
            </h2>
          </header>

          <div className="product-faq-list">
            {faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section
          className="product-detail-section"
          aria-labelledby="related-products-title"
        >
          <header>
            <span className="panel-label">
              محصولات مرتبط
            </span>
            <h2 id="related-products-title">
              گزینه‌های مشابه برای بررسی
            </h2>
          </header>

          <ProductGrid products={related} />
        </section>
      ) : null}
    </main>
  );
}
