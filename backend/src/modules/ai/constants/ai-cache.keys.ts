export const AiCacheKeys = {
  ROOT: 'ai',

  CONVERSATIONS: (userId: string, hash: string) =>
    `ai:user:${userId}:conversations:${hash}`,

  CONVERSATION_DETAIL: (userId: string, conversationId: string) =>
    `ai:user:${userId}:conversation:${conversationId}`,

  PRODUCT_CONTEXT: (productId: string) => `ai:context:product:${productId}`,

  CATALOG_SEARCH: (hash: string) => `ai:context:catalog:${hash}`,

  USER_BEHAVIOR: (userId: string) => `ai:context:user-behavior:${userId}`,

  PRODUCT_COMPARISON: (hash: string) => `ai:comparison:${hash}`,

  PRODUCT_CONTENT: (productId: string) => `ai:content:product:${productId}`,

  ARTICLE_DRAFT: (hash: string) => `ai:article:${hash}`,

  ABANDONED_OFFER: (productId: string, identity: string) =>
    `ai:offer:abandoned:${productId}:${identity}`,
} as const;
