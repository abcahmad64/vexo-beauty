export const RefundCacheKeys = {
  ROOT: 'refund',

  ADMIN_LIST: (hash: string) => `refund:admin:list:${hash}`,

  USER_LIST: (userId: string, hash: string) =>
    `refund:user:${userId}:list:${hash}`,

  ADMIN_DETAIL: (refundId: string) => `refund:admin:detail:${refundId}`,

  USER_DETAIL: (userId: string, refundId: string) =>
    `refund:user:${userId}:detail:${refundId}`,

  BY_PAYMENT: (paymentId: string) => `refund:payment:${paymentId}`,

  BY_ORDER: (orderId: string, hash: string) =>
    `refund:order:${orderId}:${hash}`,

  PAYMENT_SUMMARY: (paymentId: string) => `refund:payment:${paymentId}:summary`,
} as const;
