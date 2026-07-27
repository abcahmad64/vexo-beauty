import { Injectable } from '@nestjs/common';

import { AdminReportExportQueryDto } from '../dto/admin-report-export-query.dto';

import { AdminReportRequestDto } from '../dto/admin-report-request.dto';

import { AdminReportService } from './admin-report.service';

type ExportResult = {
  fileName: string;
  mimeType: string;
  content: string;
};

@Injectable()
export class AdminReportExportService {
  constructor(private readonly adminReportService: AdminReportService) {}

  async exportReport(
    query: AdminReportExportQueryDto,
    actorId?: string,
  ): Promise<ExportResult> {
    const format = query.format ?? 'csv';

    const reportRequest: AdminReportRequestDto = {
      reportType: query.reportType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      groupBy: query.groupBy,
      currency: query.currency,
    };

    const exportFilters = this.toExportFilters(reportRequest);

    const result = await this.adminReportService.generateReport(reportRequest);

    await this.adminReportService.logExport(
      query.reportType,
      format,
      exportFilters,
      actorId,
    );

    if (format === 'json') {
      return {
        fileName: this.fileName(query.reportType, 'json'),
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(result, null, 2),
      };
    }

    return {
      fileName: this.fileName(query.reportType, 'csv'),
      mimeType: 'text/csv; charset=utf-8',
      content: this.toCsv(result),
    };
  }

  private toExportFilters(
    request: AdminReportRequestDto,
  ): Record<string, unknown> {
    return {
      reportType: request.reportType,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      groupBy: request.groupBy,
      currency: request.currency,
    };
  }

  private toCsv(report: unknown): string {
    const rows = this.extractRows(report);

    if (rows.length === 0) {
      return '\uFEFFkey,value\n';
    }

    const headers = Array.from(
      rows.reduce<Set<string>>((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));

        return set;
      }, new Set<string>()),
    );

    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.csvCell(row[header])).join(','),
      ),
    ];

    return `\uFEFF${lines.join('\n')}`;
  }

  private extractRows(report: unknown): Array<Record<string, unknown>> {
    if (!report || typeof report !== 'object') {
      return [];
    }

    const record = report as Record<string, unknown>;

    if (Array.isArray(record.rows)) {
      return record.rows.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      );
    }

    const breakdowns = record.breakdowns;

    if (
      breakdowns &&
      typeof breakdowns === 'object' &&
      !Array.isArray(breakdowns)
    ) {
      const rows: Array<Record<string, unknown>> = [];

      for (const [section, value] of Object.entries(breakdowns)) {
        if (!Array.isArray(value)) {
          continue;
        }

        for (const item of value) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            rows.push({
              section,
              ...(item as Record<string, unknown>),
            });
          }
        }
      }

      return rows;
    }

    const summary = record.summary;

    if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
      return Object.entries(summary as Record<string, unknown>).map(
        ([key, value]) => ({
          key,
          value,
        }),
      );
    }

    return [];
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

  private fileName(reportType: string, extension: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return `report-${reportType.toLowerCase()}-${timestamp}.${extension}`;
  }
}
