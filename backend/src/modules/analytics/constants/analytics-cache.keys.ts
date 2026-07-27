export const AnalyticsCacheKeys = {
  ROOT: 'analytics',

  DASHBOARD: (hash: string) => `analytics:dashboard:${hash}`,

  SALES: (hash: string) => `analytics:sales:${hash}`,

  ORDERS: (hash: string) => `analytics:orders:${hash}`,

  PAYMENTS: (hash: string) => `analytics:payments:${hash}`,

  PRODUCTS: (hash: string) => `analytics:products:${hash}`,

  CUSTOMERS: (hash: string) => `analytics:customers:${hash}`,

  EVENTS: (hash: string) => `analytics:events:${hash}`,

  METRICS: (hash: string) => `analytics:metrics:${hash}`,

  METRIC_DETAIL: (metricName: string) => `analytics:metric:${metricName}`,
} as const;
