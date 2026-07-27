export const SearchCacheKeys = {
  ROOT: 'search',

  PRODUCTS: (hash: string) => `search:products:${hash}`,

  ADMIN_PRODUCTS: (hash: string) => `search:admin:products:${hash}`,

  CATEGORIES: (hash: string) => `search:categories:${hash}`,

  BRANDS: (hash: string) => `search:brands:${hash}`,

  GLOBAL: (hash: string) => `search:global:${hash}`,

  ADMIN_GLOBAL: (hash: string) => `search:admin:global:${hash}`,

  SUGGESTIONS: (hash: string) => `search:suggestions:${hash}`,
} as const;
