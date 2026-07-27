import { Injectable } from '@nestjs/common';

import { AdminContentExportQueryDto } from '../dto/admin-content-export-query.dto';

import { AdminQueryContentDto } from '../dto/admin-query-content.dto';

import { AdminContentService } from './admin-content.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminContentExportService {
  constructor(private readonly adminContentService: AdminContentService) {}

  async exportContent(
    query: AdminContentExportQueryDto,
  ): Promise<ExportResult> {
    const entity = query.entity ?? 'pages';

    const format = query.format ?? 'csv';

    const adminQuery = this.toAdminQuery(query);

    const rows =
      entity === 'blocks'
        ? await this.adminContentService.findBlocksForExport(adminQuery)
        : entity === 'faqs'
          ? await this.adminContentService.findFaqsForExport(adminQuery)
          : await this.adminContentService.findPagesForExport(adminQuery);

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

  private toAdminQuery(
    query: AdminContentExportQueryDto,
  ): AdminQueryContentDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      language: query.language,
      status: query.status,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
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
    if (!row) {
      return ['id', 'title', 'status', 'language', 'createdAt'];
    }

    if ('slug' in row) {
      return [
        'id',
        'slug',
        'language',
        'title',
        'status',
        'visibility',
        'publishedAt',
        'createdAt',
      ];
    }

    if ('key' in row) {
      return [
        'id',
        'key',
        'language',
        'placement',
        'title',
        'status',
        'sortOrder',
        'createdAt',
      ];
    }

    return [
      'id',
      'language',
      'category',
      'question',
      'status',
      'sortOrder',
      'createdAt',
    ];
  }

  private resolveCell(row: Record<string, unknown>, key: string): unknown {
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

    return `content-${entity}-${timestamp}.${extension}`;
  }
}
