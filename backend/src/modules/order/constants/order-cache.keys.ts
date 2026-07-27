export const OrderCacheKeys = {
  ROOT: 'order',

  USER_LIST: (userId: string, hash: string) =>
    `order:user:${userId}:list:${hash}`,

  USER_DETAIL: (userId: string, orderId: string) =>
    `order:user:${userId}:detail:${orderId}`,

  ADMIN_LIST: (hash: string) => `order:admin:list:${hash}`,

  ADMIN_DETAIL: (orderId: string) => `order:admin:detail:${orderId}`,

  ORDER_NUMBER: (orderNumber: string) => `order:number:${orderNumber}`,
} as const;
