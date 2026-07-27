'use client';

import Link from 'next/link';
import {
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

import type { NavigationItem } from '@/types/storefront';

import { CartBadge } from '@/components/cart/cart-badge';

import { BrandMark } from '../ui/brand-mark';

type SiteHeaderProps = {
  categories: NavigationItem[];
  onOpenSearch: () => void;
};

export function SiteHeader({
  categories,
  onOpenSearch,
}: SiteHeaderProps) {
  const visibleCategories = categories.filter(
    (category) => category.stats.productCount > 0,
  );

  return (
    <header className="site-header">
      <BrandMark />

      <nav className="site-header__nav" aria-label="ناوبری اصلی">
        <Link href="/products">فروشگاه</Link>

        {visibleCategories.slice(0, 4).map((category) => (
          <Link key={category.id} href={category.path}>
            {category.name}
          </Link>
        ))}

        <Link href="/beauty-assistant">
          <Sparkles aria-hidden="true" />
          مشاوره هوشمند خرید
        </Link>
      </nav>

      <div className="site-header__actions">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="جست‌وجو"
        >
          <Search aria-hidden="true" />
        </button>

        <Link
          href="/cart"
          className="cart-action-link"
          aria-label="سبد خرید"
        >
          <ShoppingBag aria-hidden="true" />
          <CartBadge />
        </Link>

        <button type="button" aria-label="بازکردن منو">
          <Menu aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
