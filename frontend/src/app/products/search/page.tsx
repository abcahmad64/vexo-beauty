import type { Metadata } from 'next';

import { CatalogPage } from '@/components/catalog/catalog-page';
import { getCatalogPageData } from '@/lib/api/storefront';

export const dynamic = 'force-dynamic';

type SearchPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function value(
  input: string | string[] | undefined,
): string | undefined {
  return Array.isArray(input) ? input[0] : input;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = value(params.q)?.trim();

  return {
    title: query
      ? `جست‌وجوی ${query} | وکسو بیوتی`
      : 'جست‌وجوی محصولات | وکسو بیوتی',
    description: query
      ? `نتایج جست‌وجوی محصولات برای ${query}`
      : 'جست‌وجوی محصولات فروشگاه وکسو بیوتی',
  };
}

export default async function ProductSearchPage({
  searchParams,
}: SearchPageProps) {
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
      mode="search"
    />
  );
}
