'use client';

import {
  Check,
  LoaderCircle,
  ShoppingBag,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import type {
  ApiEnvelope,
  CustomerCart,
} from '@/types/storefront';

import { dispatchCartUpdated } from './cart-events';

type AddToCartButtonProps = {
  productId: string;
  variantId?: string | null;
  disabled?: boolean;
  maxQuantity?: number;
  className?: string;
};

export function AddToCartButton({
  productId,
  variantId,
  disabled = false,
  maxQuantity,
  className = 'button button--primary',
}: AddToCartButtonProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState<string | null>(
    null,
  );

  async function addToCart() {
    if (disabled || pending) {
      return;
    }

    setPending(true);
    setAdded(false);
    setMessage(null);

    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
          ...(variantId
            ? {
                variantId,
              }
            : {}),
        }),
      });

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      if (response.status === 401) {
        const next = encodeURIComponent(
          pathname || '/',
        );

        router.push(`/login?next=${next}`);
        return;
      }

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ||
            'افزودن کالا به سبد خرید انجام نشد.',
        );
      }

      setAdded(true);
      setMessage('کالا به سبد خرید افزوده شد.');
      dispatchCartUpdated();

      window.setTimeout(() => {
        setAdded(false);
      }, 1800);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'افزودن کالا به سبد خرید انجام نشد.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="add-to-cart-control">
      <button
        type="button"
        className={className}
        disabled={
          disabled ||
          pending ||
          maxQuantity === 0
        }
        onClick={addToCart}
      >
        {pending ? (
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
        ) : added ? (
          <Check aria-hidden="true" />
        ) : (
          <ShoppingBag aria-hidden="true" />
        )}

        {pending
          ? 'در حال افزودن...'
          : added
            ? 'به سبد افزوده شد'
            : disabled || maxQuantity === 0
              ? 'ناموجود'
              : 'افزودن به سبد خرید'}
      </button>

      {message ? (
        <p
          className={
            added
              ? 'add-to-cart-control__message is-success'
              : 'add-to-cart-control__message'
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
