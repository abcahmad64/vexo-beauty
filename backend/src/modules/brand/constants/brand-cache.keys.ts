export const BrandCacheKeys = {
  ROOT: 'brand',

  PUBLIC_LIST: (hash: string) => `brand:public:list:${hash}`,

  PUBLIC_DETAIL: (brandId: string) => `brand:public:detail:${brandId}`,

  PUBLIC_SLUG: (slug: string) => `brand:public:slug:${slug}`,

  ADMIN_LIST: (hash: string) => `brand:admin:list:${hash}`,

  ADMIN_DETAIL: (brandId: string) => `brand:admin:detail:${brandId}`,

  PRODUCT_COUNT: (brandId: string) => `brand:${brandId}:product-count`,
} as const;
