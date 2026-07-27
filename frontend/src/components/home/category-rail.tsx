import Link from 'next/link';
import {
  ArrowLeft,
  Grid2X2,
  Package,
} from 'lucide-react';

import type { NavigationItem } from '@/types/storefront';

type CategoryRailProps = {
  categories: NavigationItem[];
};

export function CategoryRail({ categories }: CategoryRailProps) {
  const visibleCategories = categories.filter(
    (category) =>
      category.stats.productCount > 0 &&
      Boolean(category.name.trim()) &&
      Boolean(category.path),
  );

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <section className="category-rail" aria-labelledby="category-rail-title">
      <h2 id="category-rail-title" className="sr-only">
        دسته‌بندی محصولات
      </h2>

      <div className="category-rail__track">
        {visibleCategories.slice(0, 12).map((category) => {
          const image =
            category.media?.image ??
            category.media?.iconUrl ??
            null;

          return (
            <Link
              key={category.id}
              href={category.path}
              className="category-chip"
            >
              <span className="category-chip__visual">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" />
                ) : (
                  <Package aria-hidden="true" />
                )}
              </span>

              <strong>{category.name}</strong>
              <small>
                {new Intl.NumberFormat('fa-IR').format(
                  category.stats.productCount,
                )}{' '}
                محصول
              </small>
            </Link>
          );
        })}

        <Link href="/products" className="category-chip category-chip--all">
          <span className="category-chip__visual">
            <Grid2X2 aria-hidden="true" />
          </span>
          <strong>همهٔ محصولات</strong>
          <ArrowLeft aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
