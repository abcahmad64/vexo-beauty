export const VariantCacheKeys = {
  ROOT: 'variant',

  PUBLIC_PRODUCT_LIST: (productId: string) =>
    `variant:public:product:${productId}`,

  PUBLIC_DETAIL: (variantId: string) => `variant:public:detail:${variantId}`,

  PUBLIC_SKU: (sku: string) => `variant:public:sku:${sku.toUpperCase()}`,

  ADMIN_LIST: (hash: string) => `variant:admin:list:${hash}`,

  ADMIN_PRODUCT_LIST: (productId: string) =>
    `variant:admin:product:${productId}`,

  ADMIN_DETAIL: (variantId: string) => `variant:admin:detail:${variantId}`,

  ADMIN_SKU: (sku: string) => `variant:admin:sku:${sku.toUpperCase()}`,

  INVENTORY_SUMMARY: (variantId: string) =>
    `variant:${variantId}:inventory-summary`,
} as const;
