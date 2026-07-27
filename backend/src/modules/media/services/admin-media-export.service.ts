import { Injectable } from '@nestjs/common';

import { AdminMediaExportQueryDto } from '../dto/admin-media-export-query.dto';

import { AdminQueryMediaDto } from '../dto/admin-query-media.dto';

import { AdminMediaService } from './admin-media.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminMediaExportService {
  constructor(private readonly adminMediaService: AdminMediaService) {}

  async exportMedia(query: AdminMediaExportQueryDto): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminMediaService.findForExport(
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

  private toAdminQuery(query: AdminMediaExportQueryDto): AdminQueryMediaDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      entityId: query.entityId,
      entityType: query.entityType,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'mediaKey',
      'entityType',
      'entityId',
      'entityLabel',
      'url',
      'altText',
      'sortOrder',
      'isPrimary',
      'sourceTable',
      'sourceColumn',
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
    if (key === 'sourceTable' || key === 'sourceColumn') {
      const source = row.source;

      if (source && typeof source === 'object') {
        if (key === 'sourceTable' && 'table' in source) {
          return source.table;
        }

        if (key === 'sourceColumn' && 'column' in source) {
          return source.column;
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

    return `media-${timestamp}.${extension}`;
  }
}
