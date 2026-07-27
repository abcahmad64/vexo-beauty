import type { StorefrontProduct } from '@/types/storefront';

import { ProductCard } from './product-card';

type ProductGridProps = {
  products: StorefrontProduct[];
  className?: string;
};

export function ProductGrid({
  products,
  className,
}: ProductGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        'product-grid',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
        />
      ))}
    </div>
  );
}
