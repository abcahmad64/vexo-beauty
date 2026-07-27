export const ShipmentCacheKeys = {
  ROOT: 'shipment',

  ADMIN_LIST: (hash: string) => `shipment:admin:list:${hash}`,

  USER_LIST: (userId: string, hash: string) =>
    `shipment:user:${userId}:list:${hash}`,

  ADMIN_DETAIL: (orderId: string) => `shipment:admin:detail:${orderId}`,

  USER_DETAIL: (userId: string, orderId: string) =>
    `shipment:user:${userId}:detail:${orderId}`,

  TRACKING: (trackingNumber: string) => `shipment:tracking:${trackingNumber}`,
} as const;
