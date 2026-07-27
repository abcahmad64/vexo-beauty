import { Injectable } from '@nestjs/common';

import { AdminQueryStoreSettingDto } from '../dto/admin-query-store-setting.dto';

import { AdminStoreSettingExportQueryDto } from '../dto/admin-store-setting-export-query.dto';

import { AdminStoreSettingService } from './admin-store-setting.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminStoreSettingExportService {
  constructor(
    private readonly adminStoreSettingService: AdminStoreSettingService,
  ) {}

  async exportSettings(
    query: AdminStoreSettingExportQueryDto,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const rows = await this.adminStoreSettingService.findForExport(
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
    query: AdminStoreSettingExportQueryDto,
  ): AdminQueryStoreSettingDto {
    return {
      page: 1,
      limit: 200,
      q: query.q,
      group: query.group,
      type: query.type,
      sortBy: 'key',
      sortDirection: 'asc',
    };
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    const headers = [
      'id',
      'key',
      'group',
      'type',
      'label',
      'valueText',
      'isPublic',
      'isReadonly',
      'isActive',
      'updatedAt',
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
    if (key === 'isPublic' || key === 'isReadonly' || key === 'isActive') {
      const flags = row.flags;

      if (flags && typeof flags === 'object') {
        if (key === 'isPublic' && 'isPublic' in flags) {
          return flags.isPublic;
        }

        if (key === 'isReadonly' && 'isReadonly' in flags) {
          return flags.isReadonly;
        }

        if (key === 'isActive' && 'isActive' in flags) {
          return flags.isActive;
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

    return `store-settings-${timestamp}.${extension}`;
  }
}
