'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  ApiEnvelope,
  CustomerCart,
} from '@/types/storefront';

import { CART_UPDATED_EVENT } from './cart-events';

export function CartBadge() {
  const [count, setCount] = useState(0);

  const loadCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart', {
        cache: 'no-store',
      });

      if (response.status === 401) {
        setCount(0);
        return;
      }

      const payload =
        (await response.json()) as ApiEnvelope<CustomerCart>;

      setCount(
        response.ok && payload.success && payload.data
          ? payload.data.summary.totalItems
          : 0,
      );
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const initialLoad = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        void loadCart();
      }
    }, 0);

    const onCartUpdated = () => {
      if (!controller.signal.aborted) {
        void loadCart();
      }
    };

    window.addEventListener(
      CART_UPDATED_EVENT,
      onCartUpdated,
    );

    window.addEventListener(
      'focus',
      onCartUpdated,
    );

    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);

      window.removeEventListener(
        CART_UPDATED_EVENT,
        onCartUpdated,
      );

      window.removeEventListener(
        'focus',
        onCartUpdated,
      );
    };
  }, [loadCart]);

  if (count <= 0) {
    return null;
  }

  return (
    <span
      className="cart-badge"
      aria-label={`${count} کالا در سبد خرید`}
    >
      {new Intl.NumberFormat('fa-IR').format(count)}
    </span>
  );
}
