export const UserCacheKeys = {
  ROOT: 'user',

  PROFILE: (userId: string) => `user:profile:${userId}`,

  ADMIN_LIST: (hash: string) => `user:admin:list:${hash}`,

  ADMIN_DETAIL: (userId: string) => `user:admin:detail:${userId}`,

  ACCESS: (userId: string) => `user:access:${userId}`,

  SUMMARY: (userId: string) => `user:summary:${userId}`,
} as const;
