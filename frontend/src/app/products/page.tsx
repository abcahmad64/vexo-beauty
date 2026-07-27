import type { Metadata } from 'next';

import { CatalogPage } from '@/components/catalog/catalog-page';
import { getCatalogPageData } from '@/lib/api/storefront';

export const dynamic = 'force-dynamic';

type ProductsPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function value(
  input: string | string[] | undefined,
): string | undefined {
  return Array.isArray(input) ? input[0] : input;
}

export const metadata: Metadata = {
  title: 'محصولات | وکسو بیوتی',
  description: 'مشاهده و جست‌وجوی محصولات وکسو بیوتی',
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  const data = await getCatalogPageData({
    q: value(params.q) ?? '',
    page: value(params.page) ?? 1,
    limit: value(params.limit) ?? 12,
    sort: value(params.sort),
    brandSlug: value(params.brandSlug),
    categorySlug: value(params.categorySlug),
    inStock: value(params.inStock),
    hasDiscount: value(params.hasDiscount),
    minPrice: value(params.minPrice),
    maxPrice: value(params.maxPrice),
  });

  return (
    <CatalogPage
      data={data}
      searchParams={params}
      mode="catalog"
    />
  );
}
