import type {
  ApiEnvelope,
  HomeAssistantData,
  HomePageData,
  NavigationPageData,
  StorefrontHomeData,
} from '@/types/storefront';

const apiBase =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.INTERNAL_API_BASE_URL ??
      'http://localhost:4000/api'
    : process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api';

export async function requestPublicData<T>(
  pathname: string,
): Promise<T | null> {
  try {
    const response = await fetch(`${apiBase}${pathname}`, {
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 60,
      },
    });

    if (!response.ok) {
      console.error(
        `[storefront] ${pathname} returned HTTP ${response.status}`,
      );
      return null;
    }

    const envelope = (await response.json()) as ApiEnvelope<T>;

    if (!envelope.success || !envelope.data) {
      return null;
    }

    return envelope.data;
  } catch (error) {
    console.error(`[storefront] Failed to fetch ${pathname}`, error);
    return null;
  }
}

export async function getStorefrontHomeData(): Promise<StorefrontHomeData> {
  const [home, navigation, assistant] = await Promise.all([
    requestPublicData<HomePageData>(
      '/products/home/page-data?limit=8',
    ),
    requestPublicData<NavigationPageData>(
      '/products/navigation/page-data?limit=12',
    ),
    requestPublicData<HomeAssistantData>(
      '/products/home/assistant?limit=8',
    ),
  ]);

  return {
    home,
    navigation,
    assistant:
      assistant?.safety.safeOutput === true
        ? assistant
        : null,
  };
}

import type {
  CatalogPageData,
  ProductPageData,
} from '@/types/storefront';

type PublicQueryValue =
  | string
  | number
  | boolean
  | undefined;

function buildPublicQuery(
  values: Record<string, PublicQueryValue>,
): string {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === '' ||
      value === false
    ) {
      return;
    }

    params.set(key, String(value));
  });

  const query = params.toString();

  return query ? `?${query}` : '';
}

export async function getCatalogPageData(
  query: Record<string, PublicQueryValue> = {},
): Promise<CatalogPageData | null> {
  return requestPublicData<CatalogPageData>(
    `/products/search/page-data${buildPublicQuery({
      q: query.q ?? '',
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      sort: query.sort,
      brandSlug: query.brandSlug,
      categorySlug: query.categorySlug,
      inStock: query.inStock,
      hasDiscount: query.hasDiscount,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    })}`,
  );
}

export async function getCatalogLandingPageData(
  kind: 'category' | 'brand' | 'type' | 'model',
  slug: string,
  query: Record<string, PublicQueryValue> = {},
): Promise<CatalogPageData | null> {
  return requestPublicData<CatalogPageData>(
    `/products/${kind}/${encodeURIComponent(slug)}/page-data${buildPublicQuery({
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      sort: query.sort,
      inStock: query.inStock,
      hasDiscount: query.hasDiscount,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
    })}`,
  );
}

export async function getProductPageData(
  identifier: string,
): Promise<ProductPageData | null> {
  return requestPublicData<ProductPageData>(
    `/products/${encodeURIComponent(identifier)}/page-data`,
  );
}
