import { notFound } from 'next/navigation';

import { CatalogPage } from '@/components/catalog/catalog-page';
import { getCatalogLandingPageData } from '@/lib/api/storefront';

type LandingPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = 'force-dynamic';

export default async function BrandPage({
  params,
  searchParams,
}: LandingPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const query = await searchParams;

  const data = await getCatalogLandingPageData(
    'brand',
    slug,
    {
      page: first(query.page),
      sort: first(query.sort),
      inStock: first(query.inStock),
      hasDiscount: first(query.hasDiscount),
      minPrice: first(query.minPrice),
      maxPrice: first(query.maxPrice),
    },
  );

  if (!data) {
    notFound();
  }

  return (
    <CatalogPage
      data={data}
      searchParams={resolvedSearchParams}
      mode="catalog"
    />
  );
}
