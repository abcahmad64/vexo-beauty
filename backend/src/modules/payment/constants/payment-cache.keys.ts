export const PaymentCacheKeys = {
  ROOT: 'payment',

  USER_LIST: (userId: string, hash: string) =>
    `payment:user:${userId}:list:${hash}`,

  USER_DETAIL: (userId: string, paymentId: string) =>
    `payment:user:${userId}:detail:${paymentId}`,

  ADMIN_LIST: (hash: string) => `payment:admin:list:${hash}`,

  ADMIN_DETAIL: (paymentId: string) => `payment:admin:detail:${paymentId}`,

  ORDER_PAYMENTS: (orderId: string) => `payment:order:${orderId}`,
} as const;
