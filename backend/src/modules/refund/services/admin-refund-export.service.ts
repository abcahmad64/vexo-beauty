import { Injectable } from '@nestjs/common';

import { AdminRefundExportQueryDto } from '../dto/admin-refund-export-query.dto';

import { AdminQueryRefundDto } from '../dto/admin-query-refund.dto';

import { AdminRefundService } from './admin-refund.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminRefundExportService {
  constructor(private readonly adminRefundService: AdminRefundService) {}

  async exportRefunds(query: AdminRefundExportQueryDto): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminRefundService.findForExport(
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

  private toAdminQuery(query: AdminRefundExportQueryDto): AdminQueryRefundDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      paymentId: query.paymentId,
      orderId: query.orderId,
      userId: query.userId,
      email: query.email,
      orderNumber: query.orderNumber,
      status: query.status,
      paymentStatus: query.paymentStatus,
      currency: query.currency,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      processedFrom: query.processedFrom,
      processedTo: query.processedTo,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'refundId',
      'paymentId',
      'orderNumber',
      'customerEmail',
      'amount',
      'currency',
      'status',
      'paymentStatus',
      'reason',
      'processedAt',
      'createdAt',
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
    if (key === 'refundId') {
      return row.id;
    }

    if (key === 'paymentId') {
      return row.paymentId;
    }

    if (key === 'amount') {
      return row.amount;
    }

    if (key === 'status') {
      return row.status;
    }

    if (key === 'reason') {
      return row.reason;
    }

    if (key === 'processedAt') {
      return row.processedAt;
    }

    if (key === 'createdAt') {
      return row.createdAt;
    }

    if (key === 'orderNumber') {
      const order = row.order;

      if (order && typeof order === 'object' && 'orderNumber' in order) {
        return order.orderNumber;
      }

      return '';
    }

    if (key === 'currency' || key === 'paymentStatus') {
      const payment = row.payment;

      if (payment && typeof payment === 'object') {
        if (key === 'currency' && 'currency' in payment) {
          return payment.currency;
        }

        if (key === 'paymentStatus' && 'status' in payment) {
          return payment.status;
        }
      }

      return '';
    }

    if (key === 'customerEmail') {
      const customer = row.customer;

      if (customer && typeof customer === 'object' && 'email' in customer) {
        return customer.email;
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

    return `refunds-${timestamp}.${extension}`;
  }
}
