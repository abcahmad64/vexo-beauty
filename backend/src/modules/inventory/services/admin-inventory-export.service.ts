import { Injectable } from '@nestjs/common';

import { AdminInventoryExportQueryDto } from '../dto/admin-inventory-export-query.dto';

import { AdminInventoryService } from './admin-inventory.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminInventoryExportService {
  constructor(private readonly adminInventoryService: AdminInventoryService) {}

  async exportInventory(
    query: AdminInventoryExportQueryDto,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const result = await this.adminInventoryService.findAll({
      page: 1,
      limit: 5000,
      q: query.q,
      productId: query.productId,
      variantId: query.variantId,
      warehouseId: query.warehouseId,
      warehouseCode: query.warehouseCode,
      stockStatus: query.stockStatus,
      includeInactiveWarehouse: true,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });

    if (format === 'json') {
      return {
        fileName: this.fileName('json'),
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(result.data, null, 2),
      };
    }

    return {
      fileName: this.fileName('csv'),
      mimeType: 'text/csv; charset=utf-8',
      content: this.toCsv(result.data),
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'inventoryId',
      'productName',
      'productSku',
      'variantSku',
      'warehouseCode',
      'warehouseName',
      'quantity',
      'reservedQuantity',
      'availableQuantity',
      'lowStockThreshold',
      'isLowStock',
      'isOutOfStock',
      'createdAt',
      'createdAtFa',
      'updatedAt',
      'updatedAtFa',
    ];

    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => this.csvCell(this.resolveCell(row, header)))
          .join(','),
      ),
    ];

    return `\uFEFF${lines.join('\n')}`;
  }

  private resolveCell(row: Record<string, unknown>, key: string): unknown {
    if (key === 'inventoryId') {
      return row.id;
    }

    if (key === 'productName' || key === 'productSku') {
      const product = row.product;

      if (product && typeof product === 'object') {
        if (key === 'productName' && 'name' in product) {
          return product.name;
        }

        if (key === 'productSku' && 'sku' in product) {
          return product.sku;
        }
      }

      return '';
    }

    if (key === 'variantSku') {
      const variant = row.variant;

      if (variant && typeof variant === 'object' && 'sku' in variant) {
        return variant.sku;
      }

      return '';
    }

    if (key === 'warehouseCode' || key === 'warehouseName') {
      const warehouse = row.warehouse;

      if (warehouse && typeof warehouse === 'object') {
        if (key === 'warehouseCode' && 'code' in warehouse) {
          return warehouse.code;
        }

        if (key === 'warehouseName' && 'name' in warehouse) {
          return warehouse.name;
        }
      }

      return '';
    }

    if (
      key === 'quantity' ||
      key === 'reservedQuantity' ||
      key === 'availableQuantity' ||
      key === 'lowStockThreshold' ||
      key === 'isLowStock' ||
      key === 'isOutOfStock'
    ) {
      const stock = row.stock;

      if (stock && typeof stock === 'object' && key in stock) {
        return stock[key as keyof typeof stock];
      }

      return '';
    }

    return row[key];
  }

  private csvCell(value: unknown): string {
    const text = this.csvCellText(value);

    return text === '' ? '' : `"${text.replace(/"/g, '""')}"`;
  }

  private csvCellText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '';
    }
  }

  private fileName(extension: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `inventory-${timestamp}.${extension}`;
  }
}
