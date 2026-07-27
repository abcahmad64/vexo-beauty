export const AddressCacheKeys = {
  ROOT: 'address',

  USER_LIST: (userId: string, hash: string) =>
    `address:user:${userId}:list:${hash}`,

  USER_DEFAULT: (userId: string) => `address:user:${userId}:default`,

  DETAIL: (userId: string, addressId: string) =>
    `address:user:${userId}:detail:${addressId}`,
} as const;
