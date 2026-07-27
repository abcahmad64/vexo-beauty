export const InvoiceCacheKeys = {
  ROOT: 'invoice',

  ADMIN_LIST: (hash: string) => `invoice:admin:list:${hash}`,

  USER_LIST: (userId: string, hash: string) =>
    `invoice:user:${userId}:list:${hash}`,

  ADMIN_DETAIL: (invoiceId: string) => `invoice:admin:detail:${invoiceId}`,

  USER_DETAIL: (userId: string, invoiceId: string) =>
    `invoice:user:${userId}:detail:${invoiceId}`,

  BY_ORDER: (orderId: string) => `invoice:order:${orderId}`,

  BY_PAYMENT: (paymentId: string) => `invoice:payment:${paymentId}`,

  BY_NUMBER: (invoiceNumber: string) => `invoice:number:${invoiceNumber}`,
} as const;
