import { Injectable } from '@nestjs/common';

import { AdminInvoiceExportQueryDto } from '../dto/admin-invoice-export-query.dto';

import { AdminQueryInvoiceDto } from '../dto/admin-query-invoice.dto';

import { AdminInvoiceService } from './admin-invoice.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminInvoiceExportService {
  constructor(private readonly adminInvoiceService: AdminInvoiceService) {}

  async exportInvoices(
    query: AdminInvoiceExportQueryDto,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminInvoiceService.findForExport(
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

  private toAdminQuery(
    query: AdminInvoiceExportQueryDto,
  ): AdminQueryInvoiceDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      invoiceNumber: query.invoiceNumber,
      orderId: query.orderId,
      paymentId: query.paymentId,
      userId: query.userId,
      email: query.email,
      orderNumber: query.orderNumber,
      status: query.status,
      paymentStatus: query.paymentStatus,
      currency: query.currency,
      issuedFrom: query.issuedFrom,
      issuedTo: query.issuedTo,
      dueFrom: query.dueFrom,
      dueTo: query.dueTo,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'invoiceId',
      'invoiceNumber',
      'orderNumber',
      'paymentId',
      'customerEmail',
      'amount',
      'currency',
      'status',
      'paymentStatus',
      'pdfUrl',
      'issuedAt',
      'issuedAtFa',
      'dueDate',
      'dueDateFa',
      'paidAt',
      'paidAtFa',
      'refundedAt',
      'refundedAtFa',
      'createdAt',
      'createdAtFa',
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
    if (key === 'invoiceId') {
      return row.id;
    }

    if (key === 'invoiceNumber') {
      return row.invoiceNumber;
    }

    if (key === 'paymentId') {
      return row.paymentId;
    }

    if (key === 'amount') {
      return row.amount;
    }

    if (key === 'currency') {
      return row.currency;
    }

    if (key === 'status') {
      return row.status;
    }

    if (key === 'pdfUrl') {
      return row.pdfUrl;
    }

    if (key === 'issuedAt') {
      return row.issuedAt;
    }

    if (key === 'issuedAtFa') {
      return row.issuedAtFa;
    }

    if (key === 'dueDate') {
      return row.dueDate;
    }

    if (key === 'dueDateFa') {
      return row.dueDateFa;
    }

    if (key === 'createdAt') {
      return row.createdAt;
    }

    if (key === 'createdAtFa') {
      return row.createdAtFa;
    }

    if (key === 'orderNumber') {
      const order = row.order;

      if (order && typeof order === 'object' && 'orderNumber' in order) {
        return order.orderNumber;
      }

      return '';
    }

    if (key === 'paymentStatus') {
      const payment = row.payment;

      if (payment && typeof payment === 'object' && 'status' in payment) {
        return payment.status;
      }

      return '';
    }

    if (key === 'paidAt') {
      const payment = row.payment;

      if (payment && typeof payment === 'object' && 'paidAt' in payment) {
        return payment.paidAt;
      }

      return '';
    }

    if (key === 'paidAtFa') {
      const payment = row.payment;

      if (payment && typeof payment === 'object' && 'paidAtFa' in payment) {
        return payment.paidAtFa;
      }

      return '';
    }

    if (key === 'refundedAt') {
      const payment = row.payment;

      if (payment && typeof payment === 'object' && 'refundedAt' in payment) {
        return payment.refundedAt;
      }

      return '';
    }

    if (key === 'refundedAtFa') {
      const payment = row.payment;

      if (payment && typeof payment === 'object' && 'refundedAtFa' in payment) {
        return payment.refundedAtFa;
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

    return `invoices-${timestamp}.${extension}`;
  }
}
