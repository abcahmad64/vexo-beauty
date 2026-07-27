export const ProductCacheKeys = {
  ROOT: 'product',

  LIST: (hash: string) => `product:list:${hash}`,

  DETAIL: (identifier: string) => `product:detail:${identifier}`,

  VARIANTS: (productId: string) => `product:${productId}:variants`,

  IMAGES: (productId: string) => `product:${productId}:images`,

  ATTRIBUTES: (productId: string) => `product:${productId}:attributes`,

  ADMIN_DETAIL: (productId: string) => `product:admin:detail:${productId}`,
} as const;
