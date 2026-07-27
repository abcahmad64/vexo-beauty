export const ReviewCacheKeys = {
  ROOT: 'review',

  PRODUCT_REVIEWS: (productId: string, hash: string) =>
    `review:product:${productId}:list:${hash}`,

  USER_REVIEWS: (userId: string, hash: string) =>
    `review:user:${userId}:list:${hash}`,

  ADMIN_LIST: (hash: string) => `review:admin:list:${hash}`,

  DETAIL: (reviewId: string) => `review:detail:${reviewId}`,

  PRODUCT_RATING: (productId: string) => `review:product:${productId}:rating`,
} as const;
