export const AdminCacheKeys = {
  ROOT: 'admin',

  DASHBOARD: (hash: string) => `admin:dashboard:${hash}`,

  OVERVIEW: (hash: string) => `admin:overview:${hash}`,

  HEALTH: 'admin:health',

  ACTIVITY: (hash: string) => `admin:activity:${hash}`,

  RECENT_ORDERS: (hash: string) => `admin:recent-orders:${hash}`,

  RECENT_PAYMENTS: (hash: string) => `admin:recent-payments:${hash}`,

  RECENT_USERS: (hash: string) => `admin:recent-users:${hash}`,

  RECENT_NOTIFICATIONS: (hash: string) => `admin:recent-notifications:${hash}`,
} as const;
