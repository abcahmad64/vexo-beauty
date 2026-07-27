import { Injectable } from '@nestjs/common';

import { AdminCouponExportQueryDto } from '../dto/admin-coupon-export-query.dto';

import { AdminQueryCouponDto } from '../dto/admin-query-coupon.dto';

import { AdminCouponService } from './admin-coupon.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminCouponExportService {
  constructor(private readonly adminCouponService: AdminCouponService) {}

  async exportCoupons(query: AdminCouponExportQueryDto): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminCouponService.findForExport(
      this.toAdminQuery(query),
    );

    if (format === 'json') {
      return {
        fileName: this.fileName('json'),
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(rows, null, 2),
      };
    }

    return {
      fileName: this.fileName('csv'),
      mimeType: 'text/csv; charset=utf-8',
      content: this.toCsv(rows),
    };
  }

  private toAdminQuery(query: AdminCouponExportQueryDto): AdminQueryCouponDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      code: query.code,
      type: query.type,
      status: query.status,
      startFrom: query.startFrom,
      startTo: query.startTo,
      endFrom: query.endFrom,
      endTo: query.endTo,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'couponId',
      'code',
      'type',
      'value',
      'status',
      'isActive',
      'minAmount',
      'usageLimit',
      'usedCount',
      'remainingUsage',
      'usageCount',
      'revenueAmount',
      'lastUsedAt',
      'lastUsedAtFa',
      'startDate',
      'startDateFa',
      'endDate',
      'endDateFa',
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
    if (key === 'couponId') {
      return row.id;
    }

    if (
      key === 'usageCount' ||
      key === 'revenueAmount' ||
      key === 'lastUsedAt' ||
      key === 'lastUsedAtFa'
    ) {
      const stats = row.stats;

      if (stats && typeof stats === 'object') {
        if (key === 'usageCount' && 'usageCount' in stats) {
          return stats.usageCount;
        }

        if (key === 'revenueAmount' && 'revenueAmount' in stats) {
          return stats.revenueAmount;
        }

        if (key === 'lastUsedAt' && 'lastUsedAt' in stats) {
          return stats.lastUsedAt;
        }

        if (key === 'lastUsedAtFa' && 'lastUsedAtFa' in stats) {
          return stats.lastUsedAtFa;
        }
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

    return `coupons-${timestamp}.${extension}`;
  }
}
