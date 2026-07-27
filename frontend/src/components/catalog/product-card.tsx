import Link from 'next/link';
import {
  Heart,
  ImageIcon,
  PackageCheck,
  PackageX,
  ShoppingBag,
  Star,
} from 'lucide-react';

import type {
  ProductMoneyValue,
  StorefrontProduct,
} from '@/types/storefront';

type ProductCardProps = {
  product: StorefrontProduct;
  priority?: boolean;
};

function toNumber(value: ProductMoneyValue | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: ProductMoneyValue): string {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function productImage(product: StorefrontProduct): {
  url: string | null;
  alt: string;
} {
  if (typeof product.primaryImage === 'string') {
    return {
      url: product.primaryImage || null,
      alt: product.name,
    };
  }

  return {
    url: product.primaryImage?.url ?? null,
    alt: product.primaryImage?.alt ?? product.name,
  };
}

function productPath(product: StorefrontProduct): string {
  return (
    product.cta?.path ??
    product.path ??
    `/products/${encodeURIComponent(product.slug)}`
  );
}

function productRating(product: StorefrontProduct): {
  average: number | null;
  count: number;
} {
  if (
    product.rating &&
    typeof product.rating === 'object'
  ) {
    const average =
      product.rating.average === null ||
      product.rating.average === undefined
        ? null
        : Number(product.rating.average);

    return {
      average:
        average !== null && Number.isFinite(average)
          ? average
          : null,
      count:
        product.rating.reviewCount ??
        product.reviewCount ??
        0,
    };
  }

  return {
    average:
      typeof product.rating === 'number'
        ? product.rating
        : null,
    count: product.reviewCount ?? 0,
  };
}

export function ProductCard({
  product,
}: ProductCardProps) {
  const image = productImage(product);
  const path = productPath(product);
  const rating = productRating(product);

  const available =
    product.stock.inStock &&
    product.cta?.enabled !== false;

  const hasDiscount =
    product.pricing.hasDiscount === true ||
    (
      toNumber(product.pricing.comparePrice) >
      toNumber(product.pricing.displayPrice)
    );

  const comparePrice =
    product.pricing.comparePrice ??
    product.pricing.originalPrice ??
    null;

  return (
    <article className="product-card">
      <div className="product-card__media">
        <Link
          href={path}
          className="product-card__visual"
          aria-label={`مشاهدهٔ ${product.name}`}
        >
          {image.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt}
              loading="lazy"
            />
          ) : (
            <span className="product-card__placeholder">
              <ImageIcon aria-hidden="true" />
            </span>
          )}
        </Link>

        <div className="product-card__badges">
          {hasDiscount ? (
            <span className="product-badge product-badge--sale">
              پیشنهاد ویژه
            </span>
          ) : null}

          {!available ? (
            <span className="product-badge">
              ناموجود
            </span>
          ) : null}

          {product.badges?.slice(0, 2).map((badge) => (
            <span
              key={badge}
              className="product-badge"
            >
              {badge}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="product-card__favorite"
          aria-label={`افزودن ${product.name} به علاقه‌مندی‌ها`}
          disabled
          title="پس از اتصال حساب مشتری فعال می‌شود"
        >
          <Heart aria-hidden="true" />
        </button>
      </div>

      <div className="product-card__content">
        <div className="product-card__taxonomy">
          {product.brand?.name ? (
            <Link
              href={
                product.brand.path ??
                (
                  product.brand.slug
                    ? `/products/brand/${product.brand.slug}`
                    : path
                )
              }
            >
              {product.brand.name}
            </Link>
          ) : null}

          {product.category?.name ? (
            <span>{product.category.name}</span>
          ) : null}
        </div>

        <h3>
          <Link href={path}>
            {product.name}
          </Link>
        </h3>

        {product.shortDescription ? (
          <p className="product-card__description">
            {product.shortDescription}
          </p>
        ) : null}

        {rating.average !== null ? (
          <div
            className="product-card__rating"
            aria-label={`امتیاز ${rating.average} از ۵`}
          >
            <Star aria-hidden="true" />
            <span>
              {new Intl.NumberFormat('fa-IR', {
                maximumFractionDigits: 1,
              }).format(rating.average)}
            </span>

            {rating.count > 0 ? (
              <small>
                ({new Intl.NumberFormat('fa-IR').format(rating.count)})
              </small>
            ) : null}
          </div>
        ) : null}

        <div className="product-card__commercial">
          <div className="product-card__price">
            {hasDiscount && comparePrice ? (
              <del>
                {formatMoney(comparePrice)}
              </del>
            ) : null}

            <strong>
              {formatMoney(product.pricing.displayPrice)}
              <small>
                {product.pricing.currency === 'IRR'
                  ? ' ریال'
                  : ` ${product.pricing.currency}`}
              </small>
            </strong>
          </div>

          <span
            className={
              available
                ? 'product-card__stock is-available'
                : 'product-card__stock'
            }
          >
            {available ? (
              <PackageCheck aria-hidden="true" />
            ) : (
              <PackageX aria-hidden="true" />
            )}

            {available ? 'موجود' : 'ناموجود'}
          </span>
        </div>

        <Link
          href={path}
          className="product-card__cta"
          aria-disabled={!available}
        >
          <ShoppingBag aria-hidden="true" />
          {product.cta?.label ??
            (available ? 'مشاهده و خرید' : 'مشاهده محصول')}
        </Link>
      </div>
    </article>
  );
}
