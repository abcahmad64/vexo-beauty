'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  LoaderCircle,
  PackageOpen,
  RefreshCcw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { CartItemCard } from '@/components/cart/cart-item-card';

import type {
  ApiEnvelope,
  CartItem,
  CustomerCart,
  ProductMoneyValue,
} from '@/types/storefront';

import { dispatchCartUpdated } from './cart-events';

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

export function CartScreen() {
  const [cart, setCart] =
    useState<CustomerCart | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [actionKey, setActionKey] =
    useState<string | null>(null);

  const [unauthorized, setUnauthorized] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const loadCart = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/cart', {
        cache: 'no-store',
      });

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (response.status === 401) {
        setUnauthorized(true);
        setCart(null);
        return;
      }

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'دریافت سبد خرید انجام نشد.',
        );
      }

      setUnauthorized(false);
      setCart(payload.data);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت سبد خرید انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadCart();
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
    };
  }, [loadCart]);

  async function updateQuantity(
    item: CartItem,
    quantity: number,
  ) {
    if (
      quantity < 1 ||
      quantity > item.stock.available
    ) {
      return;
    }

    setActionKey(item.id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/cart/items/${encodeURIComponent(
          item.id,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'تغییر تعداد کالا انجام نشد.',
        );
      }

      setCart(payload.data);
      dispatchCartUpdated();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'تغییر تعداد کالا انجام نشد.',
      );
    } finally {
      setActionKey(null);
    }
  }

  async function removeItem(item: CartItem) {
    setActionKey(item.id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/cart/items/${encodeURIComponent(
          item.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'حذف کالا از سبد خرید انجام نشد.',
        );
      }

      setCart(payload.data);
      dispatchCartUpdated();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'حذف کالا از سبد خرید انجام نشد.',
      );
    } finally {
      setActionKey(null);
    }
  }

  async function clearCart() {
    setActionKey('clear');
    setMessage(null);

    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
      });

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'خالی‌کردن سبد خرید انجام نشد.',
        );
      }

      setCart(payload.data);
      dispatchCartUpdated();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'خالی‌کردن سبد خرید انجام نشد.',
      );
    } finally {
      setActionKey(null);
    }
  }

  async function refreshPrices() {
    setActionKey('refresh');
    setMessage(null);

    try {
      const response = await fetch(
        '/api/cart/refresh-prices',
        {
          method: 'PATCH',
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'به‌روزرسانی قیمت‌ها انجام نشد.',
        );
      }

      setCart(payload.data);
      setMessage(
        'قیمت و موجودی کالاها به‌روز شدند.',
      );
      dispatchCartUpdated();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'به‌روزرسانی قیمت‌ها انجام نشد.',
      );
    } finally {
      setActionKey(null);
    }
  }

  if (loading) {
    return (
      <main className="cart-page">
        <div className="cart-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <p>در حال دریافت سبد خرید...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="cart-page">
        <div className="cart-state">
          <ShoppingBag aria-hidden="true" />

          <h1>سبد خرید حساب شما</h1>

          <p>
            برای مشاهده و مدیریت سبد خرید وارد حساب
            کاربری شوید.
          </p>

          <Link
            href="/login?next=%2Fcart"
            className="button button--primary"
          >
            ورود به حساب کاربری
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  const items = cart?.items ?? [];

  return (
    <main className="cart-page">
      <nav className="cart-page__breadcrumbs">
        <Link href="/">خانه</Link>
        <ArrowLeft aria-hidden="true" />
        <span>سبد خرید</span>
      </nav>

      <header className="cart-page__header">
        <div>
          <span className="panel-label">
            سبد خرید شما
          </span>

          <h1>مرور کالاهای انتخاب‌شده</h1>

          <p>
            قیمت و موجودی کالاها هنگام هر تغییر و پیش
            از پرداخت دوباره بررسی می‌شود.
          </p>
        </div>

        {items.length > 0 ? (
          <div className="cart-page__header-actions">
            <button
              type="button"
              onClick={refreshPrices}
              disabled={actionKey !== null}
            >
              <RefreshCcw
                className={
                  actionKey === 'refresh'
                    ? 'is-spinning'
                    : undefined
                }
                aria-hidden="true"
              />
              به‌روزرسانی
            </button>

            <button
              type="button"
              className="is-danger"
              onClick={clearCart}
              disabled={actionKey !== null}
            >
              <Trash2 aria-hidden="true" />
              خالی‌کردن سبد
            </button>
          </div>
        ) : null}
      </header>

      {message ? (
        <p
          className="cart-page__message"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="cart-state">
          <PackageOpen aria-hidden="true" />

          <h2>سبد خرید شما خالی است</h2>

          <p>
            محصولات فروشگاه را بررسی کنید و انتخاب‌های
            موردنظر را به سبد اضافه کنید.
          </p>

          <Link
            href="/products"
            className="button button--primary"
          >
            مشاهدهٔ محصولات
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="cart-layout cart-layout--redesigned">
          <section
            className="cart-items cart-items--redesigned"
            aria-label="کالاهای سبد خرید"
          >
            {items.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                pending={actionKey === item.id}
                onChangeQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </section>

          <aside className="cart-summary cart-summary--compact">
            <span className="panel-label">
              خلاصهٔ سبد
            </span>

            <h2>خلاصهٔ سفارش</h2>

            <dl>
              <div>
                <dt>تعداد کل</dt>
                <dd>
                  {new Intl.NumberFormat('fa-IR').format(
                    cart?.summary.totalItems ?? 0,
                  )}
                </dd>
              </div>

              <div>
                <dt>کالاهای متفاوت</dt>
                <dd>
                  {new Intl.NumberFormat('fa-IR').format(
                    cart?.summary.uniqueItems ?? 0,
                  )}
                </dd>
              </div>

              <div>
                <dt>تخفیف</dt>
                <dd>۰ ریال</dd>
              </div>

              <div>
                <dt>هزینهٔ ارسال</dt>
                <dd>در مرحلهٔ بعد</dd>
              </div>

              <div className="cart-summary__total">
                <dt>جمع فعلی</dt>
                <dd>
                  {formatMoney(
                    cart?.summary.subtotal,
                  )}{' '}
                  ریال
                </dd>
              </div>
            </dl>

            {(cart?.summary.unavailableItemsCount ?? 0) >
            0 ? (
              <p className="cart-summary__warning">
                پیش از ادامه، موجودی برخی کالاها باید
                اصلاح شود.
              </p>
            ) : null}

            {(cart?.summary.unavailableItemsCount ??
              0) > 0 ? (
              <button
                type="button"
                className="button button--primary"
                disabled
                title="ابتدا موجودی کالاهای سبد را اصلاح کنید"
              >
                ادامهٔ فرایند خرید
                <ArrowLeft aria-hidden="true" />
              </button>
            ) : (
              <Link
                href="/checkout"
                className="button button--primary"
              >
                ادامهٔ فرایند خرید
                <ArrowLeft aria-hidden="true" />
              </Link>
            )}

            <Link href="/products">
              ادامهٔ خرید
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
