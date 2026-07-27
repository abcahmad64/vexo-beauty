import { Injectable } from '@nestjs/common';

import { AdminQuerySupportChatDto } from '../dto/admin-query-support-chat.dto';

import { AdminQuerySupportTicketDto } from '../dto/admin-query-support-ticket.dto';

import { AdminSupportExportQueryDto } from '../dto/admin-support-export-query.dto';

import { AdminSupportService } from './admin-support.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminSupportExportService {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  async exportSupport(
    query: AdminSupportExportQueryDto,
  ): Promise<ExportResult> {
    const entity = query.entity ?? 'tickets';

    const format = query.format ?? 'csv';

    const rows =
      entity === 'chats'
        ? await this.adminSupportService.findChatsForExport(
            this.toChatQuery(query),
          )
        : await this.adminSupportService.findTicketsForExport(
            this.toTicketQuery(query),
          );

    if (format === 'json') {
      return {
        fileName: this.fileName(entity, 'json'),
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(rows, null, 2),
      };
    }

    return {
      fileName: this.fileName(entity, 'csv'),
      mimeType: 'text/csv; charset=utf-8',
      content: this.toCsv(rows),
    };
  }

  private toTicketQuery(
    query: AdminSupportExportQueryDto,
  ): AdminQuerySupportTicketDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      status:
        query.status === 'OPEN' ||
        query.status === 'PENDING' ||
        query.status === 'ANSWERED' ||
        query.status === 'CLOSED'
          ? query.status
          : undefined,
      assignedAgentId: query.assignedAgentId,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toChatQuery(
    query: AdminSupportExportQueryDto,
  ): AdminQuerySupportChatDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      status:
        query.status === 'OPEN' ||
        query.status === 'WAITING' ||
        query.status === 'ASSIGNED' ||
        query.status === 'CLOSED' ||
        query.status === 'ARCHIVED'
          ? query.status
          : undefined,
      assignedAgentId: query.assignedAgentId,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = this.resolveHeaders(rows[0]);

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

  private resolveHeaders(row?: Record<string, unknown>): string[] {
    if (row && 'ticketNumber' in row) {
      return [
        'id',
        'ticketNumber',
        'subject',
        'status',
        'priority',
        'channel',
        'category',
        'customerEmail',
        'assignedAgentEmail',
        'messageCount',
        'createdAt',
      ];
    }

    return [
      'id',
      'externalId',
      'status',
      'channel',
      'customerEmail',
      'assignedAgentEmail',
      'unreadByAdmin',
      'messageCount',
      'createdAt',
    ];
  }

  private resolveCell(row: Record<string, unknown>, key: string): unknown {
    if (key === 'customerEmail') {
      const customer = row.customer;

      if (customer && typeof customer === 'object' && 'email' in customer) {
        return customer.email;
      }

      return '';
    }

    if (key === 'assignedAgentEmail') {
      const agent = row.assignedAgent;

      if (agent && typeof agent === 'object' && 'email' in agent) {
        return agent.email;
      }

      return '';
    }

    if (key === 'messageCount') {
      const stats = row.stats;

      if (stats && typeof stats === 'object' && 'messageCount' in stats) {
        return stats.messageCount;
      }

      return '';
    }

    if (key === 'unreadByAdmin') {
      const unread = row.unread;

      if (unread && typeof unread === 'object' && 'byAdmin' in unread) {
        return unread.byAdmin;
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

  private fileName(entity: string, extension: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `support-${entity}-${timestamp}.${extension}`;
  }
}
