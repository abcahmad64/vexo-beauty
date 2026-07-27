export const AttributeCacheKeys = {
  ROOT: 'attribute',

  PUBLIC_LIST: (hash: string) => `attribute:public:list:${hash}`,

  ADMIN_LIST: (hash: string) => `attribute:admin:list:${hash}`,

  DETAIL: (attributeId: string) => `attribute:detail:${attributeId}`,

  VALUE_DETAIL: (attributeValueId: string) =>
    `attribute:value:${attributeValueId}`,

  PRODUCT_ATTRIBUTES: (productId: string) => `attribute:product:${productId}`,

  VARIANT_ATTRIBUTES: (variantId: string) => `attribute:variant:${variantId}`,
} as const;
