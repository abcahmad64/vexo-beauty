import { Injectable } from '@nestjs/common';

import { AdminProductExportQueryDto } from '../dto/admin-product-export-query.dto';

import { AdminProductService } from './admin-product.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminProductExportService {
  constructor(private readonly adminProductService: AdminProductService) {}

  async exportProducts(
    query: AdminProductExportQueryDto,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const result = await this.adminProductService.findAll({
      page: 1,
      limit: 5000,
      q: query.q,
      brandId: query.brandId,
      categoryId: query.categoryId,
      status: query.status,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: 'createdAt',
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
      'id',
      'name',
      'slug',
      'sku',
      'status',
      'isActive',
      'price',
      'comparePrice',
      'brandName',
      'categoryName',
      'createdAt',
      'createdAtFa',
      'updatedAt',
      'updatedAtFa',
      'deletedAt',
      'deletedAtFa',
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
    if (key === 'brandName') {
      const brand = row.brand;

      if (brand && typeof brand === 'object' && 'name' in brand) {
        return brand.name;
      }

      return '';
    }

    if (key === 'categoryName') {
      const category = row.category;

      if (category && typeof category === 'object' && 'name' in category) {
        return category.name;
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

    return `products-${timestamp}.${extension}`;
  }
}
