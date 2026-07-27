export const WishlistCacheKeys = {
  ROOT: 'wishlist',

  USER_WISHLIST: (userId: string) => `wishlist:user:${userId}`,

  USER_WISHLIST_ITEMS: (userId: string) => `wishlist:user:${userId}:items`,

  USER_WISHLIST_SUMMARY: (userId: string) => `wishlist:user:${userId}:summary`,

  PRODUCT_STATUS: (userId: string, productId: string) =>
    `wishlist:user:${userId}:product:${productId}`,
} as const;
