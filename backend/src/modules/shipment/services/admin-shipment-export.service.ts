import { Injectable } from '@nestjs/common';

import { AdminShipmentExportQueryDto } from '../dto/admin-shipment-export-query.dto';

import { AdminQueryShipmentDto } from '../dto/admin-query-shipment.dto';

import { AdminShipmentService } from './admin-shipment.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminShipmentExportService {
  constructor(private readonly adminShipmentService: AdminShipmentService) {}

  async exportShipments(
    query: AdminShipmentExportQueryDto,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminShipmentService.findForExport(
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
    query: AdminShipmentExportQueryDto,
  ): AdminQueryShipmentDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      orderId: query.orderId,
      orderNumber: query.orderNumber,
      userId: query.userId,
      email: query.email,
      phone: query.phone,
      status: query.status,
      paymentStatus: query.paymentStatus,
      shippingMethod: query.shippingMethod,
      trackingNumber: query.trackingNumber,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      shippedFrom: query.shippedFrom,
      shippedTo: query.shippedTo,
      deliveredFrom: query.deliveredFrom,
      deliveredTo: query.deliveredTo,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'orderId',
      'orderNumber',
      'customerEmail',
      'status',
      'paymentStatus',
      'shippingMethod',
      'trackingNumber',
      'shippingAmount',
      'totalAmount',
      'currency',
      'shippedAt',
      'deliveredAt',
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
    if (key === 'orderId') {
      return row.orderId;
    }

    if (key === 'orderNumber') {
      return row.orderNumber;
    }

    if (key === 'status') {
      return row.status;
    }

    if (key === 'customerEmail') {
      const customer = row.customer;

      if (customer && typeof customer === 'object' && 'email' in customer) {
        return customer.email;
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

    if (
      key === 'shippingMethod' ||
      key === 'trackingNumber' ||
      key === 'shippedAt' ||
      key === 'deliveredAt'
    ) {
      const shipment = row.shipment;

      if (shipment && typeof shipment === 'object') {
        if (key === 'shippingMethod' && 'method' in shipment) {
          return shipment.method;
        }

        if (key === 'trackingNumber' && 'trackingNumber' in shipment) {
          return shipment.trackingNumber;
        }

        if (key === 'shippedAt' && 'shippedAt' in shipment) {
          return shipment.shippedAt;
        }

        if (key === 'deliveredAt' && 'deliveredAt' in shipment) {
          return shipment.deliveredAt;
        }
      }

      return '';
    }

    if (
      key === 'shippingAmount' ||
      key === 'totalAmount' ||
      key === 'currency'
    ) {
      const amounts = row.amounts;

      if (amounts && typeof amounts === 'object') {
        if (key === 'shippingAmount' && 'shippingAmount' in amounts) {
          return amounts.shippingAmount;
        }

        if (key === 'totalAmount' && 'totalAmount' in amounts) {
          return amounts.totalAmount;
        }

        if (key === 'currency' && 'currency' in amounts) {
          return amounts.currency;
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

    return `shipments-${timestamp}.${extension}`;
  }
}
