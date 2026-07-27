'use client';

import Link from 'next/link';
import {
  LoaderCircle,
  Minus,
  PackageOpen,
  Plus,
  Trash2,
} from 'lucide-react';

import type {
  CartItem,
  ProductMoneyValue,
} from '@/types/storefront';

type CartItemCardProps = {
  item: CartItem;
  pending: boolean;
  onChangeQuantity: (
    item: CartItem,
    quantity: number,
  ) => void;
  onRemove: (item: CartItem) => void;
};

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

export function CartItemCard({
  item,
  pending,
  onChangeQuantity,
  onRemove,
}: CartItemCardProps) {
  const product = item.product;

  const productPath = product
    ? `/products/${product.slug}`
    : '/products';

  const canDecrease =
    !pending &&
    item.quantity > 1;

  const canIncrease =
    !pending &&
    item.stock.isAvailable &&
    item.quantity < item.stock.available;

  return (
    <article className="cart-product-card">
      <Link
        href={productPath}
        className="cart-product-card__media"
        aria-label={
          product
            ? `مشاهدهٔ ${product.name}`
            : 'مشاهدهٔ محصولات'
        }
      >
        {product?.image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image.url}
            alt={
              product.image.alt ??
              product.name
            }
          />
        ) : (
          <span className="cart-product-card__placeholder">
            <PackageOpen aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="cart-product-card__body">
        <header className="cart-product-card__identity">
          <div>
            {product?.sku ? (
              <span className="cart-product-card__sku">
                {product.sku}
              </span>
            ) : null}

            <h2>
              {product ? (
                <Link href={productPath}>
                  {product.name}
                </Link>
              ) : (
                'محصول در دسترس نیست'
              )}
            </h2>

            {product?.variant ? (
              <p>
                {product.variant.name ??
                  product.variant.sku}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="cart-product-card__remove"
            disabled={pending}
            onClick={() => onRemove(item)}
          >
            {pending ? (
              <LoaderCircle
                className="is-spinning"
                aria-hidden="true"
              />
            ) : (
              <Trash2 aria-hidden="true" />
            )}

            حذف
          </button>
        </header>

        <div className="cart-product-card__commercial">
          <div className="cart-product-card__price">
            <strong>
              {formatMoney(item.lineTotal)}
              <small> ریال</small>
            </strong>

            <span>
              قیمت هر عدد:{' '}
              {formatMoney(item.price)} ریال
            </span>
          </div>

          <div
            className={
              item.stock.isAvailable
                ? 'cart-product-card__stock is-available'
                : 'cart-product-card__stock'
            }
          >
            <span>
              {item.stock.isAvailable
                ? 'موجود و قابل سفارش'
                : 'موجودی کافی نیست'}
            </span>

            {item.stock.isAvailable ? (
              <small>
                {new Intl.NumberFormat('fa-IR').format(
                  item.stock.available,
                )}{' '}
                عدد قابل فروش
              </small>
            ) : null}
          </div>
        </div>

        <footer className="cart-product-card__footer">
          <div>
            <span className="cart-product-card__quantity-label">
              تعداد
            </span>

            <div
              className="cart-product-quantity"
              aria-label="تعداد کالا"
            >
              <button
                type="button"
                aria-label="کاهش تعداد"
                disabled={!canDecrease}
                onClick={() =>
                  onChangeQuantity(
                    item,
                    item.quantity - 1,
                  )
                }
              >
                <Minus aria-hidden="true" />
              </button>

              <strong>
                {new Intl.NumberFormat('fa-IR').format(
                  item.quantity,
                )}
              </strong>

              <button
                type="button"
                aria-label="افزایش تعداد"
                disabled={!canIncrease}
                onClick={() =>
                  onChangeQuantity(
                    item,
                    item.quantity + 1,
                  )
                }
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          </div>

          <Link
            href={productPath}
            className="cart-product-card__details"
          >
            مشاهدهٔ جزئیات محصول
          </Link>
        </footer>
      </div>
    </article>
  );
}
