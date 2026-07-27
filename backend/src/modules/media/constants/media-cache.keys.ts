export const MediaCacheKeys = {
  ROOT: 'media',

  PRODUCT_IMAGES: (productId: string) => `media:product:${productId}:images`,

  PRODUCT_PRIMARY_IMAGE: (productId: string) =>
    `media:product:${productId}:primary-image`,

  BRAND_LOGO: (brandId: string) => `media:brand:${brandId}:logo`,

  CATEGORY_IMAGE: (categoryId: string) => `media:category:${categoryId}:image`,

  USER_AVATAR: (userId: string) => `media:user:${userId}:avatar`,

  VARIANT_IMAGE: (variantId: string) => `media:variant:${variantId}:image`,
} as const;
