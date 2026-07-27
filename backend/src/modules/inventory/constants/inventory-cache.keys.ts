export const InventoryCacheKeys = {
  ROOT: 'inventory',

  LIST: (hash: string) => `inventory:list:${hash}`,

  DETAIL: (inventoryId: string) => `inventory:detail:${inventoryId}`,

  BY_VARIANT: (variantId: string) => `inventory:variant:${variantId}`,

  BY_WAREHOUSE: (warehouseId: string) => `inventory:warehouse:${warehouseId}`,

  LOW_STOCK: (hash: string) => `inventory:low-stock:${hash}`,

  MOVEMENTS: (hash: string) => `inventory:movements:${hash}`,

  WAREHOUSES: (hash: string) => `inventory:warehouses:${hash}`,

  WAREHOUSE_DETAIL: (warehouseId: string) =>
    `inventory:warehouse:detail:${warehouseId}`,
} as const;
