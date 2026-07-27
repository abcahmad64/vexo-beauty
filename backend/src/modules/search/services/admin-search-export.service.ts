import { Injectable } from '@nestjs/common';

import { AdminSearchExportQueryDto } from '../dto/admin-search-export-query.dto';

import { AdminSearchService } from './admin-search.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminSearchExportService {
  constructor(private readonly adminSearchService: AdminSearchService) {}

  async exportSearch(query: AdminSearchExportQueryDto): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const entity = query.entity ?? 'logs';

    const rows = await this.adminSearchService.findForExport(query);

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

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = Array.from(
      rows.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));

        return set;
      }, new Set<string>()),
    );

    if (headers.length === 0) {
      return '\uFEFFid\n';
    }

    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.csvCell(row[header])).join(','),
      ),
    ];

    return `\uFEFF${lines.join('\n')}`;
  }

  private csvCell(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'object') {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }

    let text: string;

    switch (typeof value) {
      case 'string':
        text = value;
        break;
      case 'number':
        text = String(value);
        break;
      case 'bigint':
        text = String(value);
        break;
      case 'boolean':
        text = String(value);
        break;
      case 'symbol':
        text = String(value);
        break;
      case 'function':
        throw new TypeError('CSV cell value cannot be a function.');
      default:
        throw new TypeError('Unsupported CSV cell value.');
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  private fileName(entity: string, extension: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `search-${entity}-${timestamp}.${extension}`;
  }
}
