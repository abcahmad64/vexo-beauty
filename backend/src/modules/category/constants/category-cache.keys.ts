export const CategoryCacheKeys = {
  ROOT: 'category',

  PUBLIC_LIST: (hash: string) => `category:public:list:${hash}`,

  PUBLIC_TREE: (hash: string) => `category:public:tree:${hash}`,

  PUBLIC_DETAIL: (categoryId: string) => `category:public:detail:${categoryId}`,

  PUBLIC_SLUG: (slug: string) => `category:public:slug:${slug}`,

  ADMIN_LIST: (hash: string) => `category:admin:list:${hash}`,

  ADMIN_TREE: (hash: string) => `category:admin:tree:${hash}`,

  ADMIN_DETAIL: (categoryId: string) => `category:admin:detail:${categoryId}`,

  PRODUCT_COUNT: (categoryId: string) => `category:${categoryId}:product-count`,
} as const;
