'use client';

import Link from 'next/link';
import {
  ChevronLeft,
  CircleUserRound,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

import type {
  NavigationItem,
  PublicAction,
} from '@/types/storefront';

import { CartBadge } from '@/components/cart/cart-badge';

type DesktopSidebarProps = {
  categories: NavigationItem[];
  quickActions: PublicAction[];
  onOpenSearch: () => void;
};

export function DesktopSidebar({
  categories,
  quickActions,
  onOpenSearch,
}: DesktopSidebarProps) {
  const visibleCategories = categories.filter(
    (category) => category.stats.productCount > 0,
  );

  return (
    <aside className="desktop-sidebar" aria-label="دسترسی سریع فروشگاه">
      <div className="desktop-sidebar__logo" aria-label="Vexo Beauty">
        <strong>VEXO</strong>
        <span>BEAUTY</span>
      </div>

      <button
        type="button"
        className="sidebar-search"
        onClick={onOpenSearch}
        aria-label="بازکردن جست‌وجو"
      >
        <Search aria-hidden="true" />
        <span>جست‌وجوی محصولات</span>
      </button>

      <div className="desktop-sidebar__scroll">
        {quickActions.length > 0 ? (
          <section className="sidebar-section">
            <h2>دسترسی سریع</h2>

            <nav aria-label="دسترسی سریع">
              {quickActions.map((action) => (
                <Link
                  key={action.key ?? action.path}
                  href={action.path}
                  className="sidebar-link"
                >
                  <span>{action.label}</span>
                  <ChevronLeft aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </section>
        ) : null}

        {visibleCategories.length > 0 ? (
          <section className="sidebar-section">
            <h2>دسته‌بندی‌ها</h2>

            <nav aria-label="دسته‌بندی محصولات">
              {visibleCategories.slice(0, 12).map((category) => (
                <Link
                  key={category.id}
                  href={category.path}
                  className="sidebar-category"
                >
                  <span className="sidebar-category__icon">
                    <Package aria-hidden="true" />
                  </span>

                  <span>{category.name}</span>
                </Link>
              ))}
            </nav>
          </section>
        ) : null}

        <Link href="/beauty-assistant" className="sidebar-offer">
          <Sparkles aria-hidden="true" />
          <span>
            <strong>مشاوره هوشمند خرید</strong>
          </span>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </div>

      <div className="sidebar-account">
        <div className="sidebar-account__actions">
          <Link href="/login" aria-label="حساب کاربری">
            <CircleUserRound aria-hidden="true" />
          </Link>

          <Link
            href="/cart"
            className="cart-action-link"
            aria-label="سبد خرید"
          >
            <ShoppingBag aria-hidden="true" />
            <CartBadge />
          </Link>

        </div>

        <Link href="/login" className="sidebar-account__login">
          ورود / ثبت‌نام
        </Link>
      </div>
    </aside>
  );
}
