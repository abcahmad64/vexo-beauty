export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 900,
  ONE_HOUR: 3_600,
  ONE_DAY: 86_400,

  HOME_PAGE: 300,
  LANDING_PAGE: 600,

  PRODUCT_LIST: 300,
  PRODUCT_DETAIL: 600,
  PRODUCT_VARIANTS: 300,
  PRODUCT_ATTRIBUTES: 600,
  PRODUCT_RECOMMENDATIONS: 300,
  PRODUCT_SEO: 1_800,

  SEARCH: 180,
  SEARCH_SUGGESTIONS: 120,
  SEMANTIC_SEARCH: 180,

  CATEGORY_TREE: 900,
  CATEGORY_DETAIL: 900,

  BRAND_LIST: 900,
  BRAND_DETAIL: 900,

  CART_SUMMARY: 60,
  WISHLIST_STATUS: 60,

  COUPON_VALIDATION: 60,

  ANALYTICS_DASHBOARD: 120,
  ADMIN_DASHBOARD: 60,

  NOTIFICATION_COUNT: 30,
  USER_PROFILE: 300,

  AI_PRODUCT_CONTENT: 1_800,
  AI_MARKETING_CONTENT: 900,
  AI_SALES_ADVICE: 300,
  AI_SEARCH_CONTEXT: 300,

  MEDIA_ASSET: 3_600,
  SETTINGS: 600,
} as const;

export const CACHE_NAMESPACE = {
  HOME: 'home',
  LANDING: 'landing',

  PRODUCT: 'product',
  PRODUCT_LIST: 'product:list',
  PRODUCT_DETAIL: 'product:detail',
  PRODUCT_RECOMMENDATION: 'product:recommendation',
  PRODUCT_SEO: 'product:seo',

  CATEGORY: 'category',
  CATEGORY_TREE: 'category:tree',

  BRAND: 'brand',

  SEARCH: 'search',
  SEMANTIC_SEARCH: 'search:semantic',

  CART: 'cart',
  WISHLIST: 'wishlist',
  COUPON: 'coupon',
  ORDER: 'order',
  PAYMENT: 'payment',
  INVENTORY: 'inventory',
  REVIEW: 'review',

  ANALYTICS: 'analytics',
  ADMIN: 'admin',
  NOTIFICATION: 'notification',
  USER: 'user',

  AI: 'ai',
  AI_CONTENT: 'ai:content',
  AI_MARKETING: 'ai:marketing',
  AI_SALES: 'ai:sales',
  AI_SEARCH: 'ai:search',

  MEDIA: 'media',
  SETTINGS: 'settings',
} as const;

export const CACHE_TAG = {
  HOME: 'home',
  LANDING: 'landing',

  PRODUCTS: 'products',
  PRODUCT_RECOMMENDATIONS: 'product-recommendations',
  PRODUCT_SEO: 'product-seo',

  CATEGORIES: 'categories',
  BRANDS: 'brands',

  SEARCH: 'search',
  SEMANTIC_SEARCH: 'semantic-search',

  CART: 'cart',
  WISHLIST: 'wishlist',
  COUPONS: 'coupons',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  INVENTORY: 'inventory',
  REVIEWS: 'reviews',

  ANALYTICS: 'analytics',
  ADMIN: 'admin',
  NOTIFICATIONS: 'notifications',
  USERS: 'users',

  AI: 'ai',
  AI_CONTENT: 'ai-content',
  AI_MARKETING: 'ai-marketing',
  AI_SALES: 'ai-sales',
  AI_SEARCH: 'ai-search',

  MEDIA: 'media',
  SETTINGS: 'settings',
} as const;
