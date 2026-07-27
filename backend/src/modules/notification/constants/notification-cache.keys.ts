export const NotificationCacheKeys = {
  ROOT: 'notification',

  ADMIN_LIST: (hash: string) => `notification:admin:list:${hash}`,

  USER_LIST: (userId: string, hash: string) =>
    `notification:user:${userId}:list:${hash}`,

  USER_UNREAD_COUNT: (userId: string) =>
    `notification:user:${userId}:unread-count`,

  ADMIN_DETAIL: (notificationId: string) =>
    `notification:admin:detail:${notificationId}`,

  USER_DETAIL: (userId: string, notificationId: string) =>
    `notification:user:${userId}:detail:${notificationId}`,

  TYPE_LIST: (type: string, hash: string) =>
    `notification:type:${type}:list:${hash}`,
} as const;
