export const CouponCacheKeys = {
  ROOT: 'coupon',

  ADMIN_LIST: (hash: string) => `coupon:admin:list:${hash}`,

  ADMIN_DETAIL: (couponId: string) => `coupon:admin:detail:${couponId}`,

  CODE: (code: string) => `coupon:code:${code.toUpperCase()}`,

  VALIDATION: (code: string, userId: string | undefined, amount: string) =>
    `coupon:validation:${code.toUpperCase()}:${userId ?? 'guest'}:${amount}`,

  USAGE: (couponId: string, userId: string) =>
    `coupon:${couponId}:usage:user:${userId}`,
} as const;
