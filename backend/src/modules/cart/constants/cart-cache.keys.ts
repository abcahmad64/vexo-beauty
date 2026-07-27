export const CartCacheKeys = {
  ROOT: 'cart',

  USER_CART: (userId: string) => `cart:user:${userId}`,

  USER_CART_ITEMS: (userId: string) => `cart:user:${userId}:items`,

  CART_SUMMARY: (userId: string) => `cart:user:${userId}:summary`,
} as const;
