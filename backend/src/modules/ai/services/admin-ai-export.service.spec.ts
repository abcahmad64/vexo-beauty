import { AdminAiExportQueryDto } from '../dto/admin-ai-export-query.dto';

import { AdminAiExportService } from './admin-ai-export.service';
import { AdminAiService } from './admin-ai.service';

describe('AdminAiExportService', () => {
  const fixedDate = new Date('2026-07-12T15:04:05.678Z');

  let findForExport: jest.Mock;
  let service: AdminAiExportService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);

    findForExport = jest.fn();

    service = new AdminAiExportService({
      findForExport,
    } as unknown as AdminAiService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exports an empty default query as a BOM-prefixed runs CSV', async () => {
    const query: AdminAiExportQueryDto = {};

    findForExport.mockResolvedValue([]);

    const result = await service.exportAi(query);

    expect(findForExport).toHaveBeenCalledTimes(1);
    expect(findForExport).toHaveBeenCalledWith(query);

    expect(result).toEqual({
      fileName: 'ai-runs-2026-07-12T15-04-05-678Z.csv',
      mimeType: 'text/csv; charset=utf-8',
      content: '\uFEFFid\n',
    });
  });

  it('exports JSON with stable indentation and the selected entity', async () => {
    const query: AdminAiExportQueryDto = {
      entity: 'templates',
      format: 'json',
      q: 'sales',
      taskType: 'SALES_INSIGHT',
    };

    const rows = [
      {
        id: 'template-1',
        title: 'Sales template',
        enabled: true,
      },
    ];

    findForExport.mockResolvedValue(rows);

    const result = await service.exportAi(query);

    expect(findForExport).toHaveBeenCalledWith(query);

    expect(result).toEqual({
      fileName: 'ai-templates-2026-07-12T15-04-05-678Z.json',
      mimeType: 'application/json; charset=utf-8',
      content: JSON.stringify(rows, null, 2),
    });
  });

  it('builds CSV headers from the union of row keys in discovery order', async () => {
    findForExport.mockResolvedValue([
      {
        id: 'run-1',
        title: 'First',
      },
      {
        id: 'run-2',
        status: 'COMPLETED',
      },
    ]);

    const result = await service.exportAi({
      entity: 'runs',
      format: 'csv',
    });

    expect(result.content).toBe(
      '\uFEFFid,title,status\n' + '"run-1","First",\n' + '"run-2",,"COMPLETED"',
    );
  });

  it('serializes primitive values and leaves nullish cells empty', async () => {
    findForExport.mockResolvedValue([
      {
        text: 'He said "hello"',
        count: 2,
        active: false,
        empty: null,
        missing: undefined,
      },
    ]);

    const result = await service.exportAi({
      format: 'csv',
    });

    expect(result.content).toBe(
      '\uFEFFtext,count,active,empty,missing\n' +
        '"He said ""hello""","2","false",,',
    );
  });

  it('serializes objects and arrays as escaped JSON CSV cells', async () => {
    findForExport.mockResolvedValue([
      {
        metadata: {
          source: 'ai',
          score: 0.9,
        },
        tags: ['sales', 'featured'],
      },
    ]);

    const result = await service.exportAi({
      entity: 'knowledge',
      format: 'csv',
    });

    expect(result.content).toBe(
      '\uFEFFmetadata,tags\n' +
        '"{""source"":""ai"",""score"":0.9}",' +
        '"[""sales"",""featured""]"',
    );
  });

  it('uses the explicit entity in CSV filenames', async () => {
    findForExport.mockResolvedValue([
      {
        id: 'recommendation-1',
      },
    ]);

    const result = await service.exportAi({
      entity: 'recommendations',
      format: 'csv',
    });

    expect(result.fileName).toBe(
      'ai-recommendations-2026-07-12T15-04-05-678Z.csv',
    );

    expect(result.mimeType).toBe('text/csv; charset=utf-8');
  });

  it('propagates export data retrieval failures', async () => {
    const failure = new Error('Export data unavailable');

    findForExport.mockRejectedValue(failure);

    await expect(
      service.exportAi({
        entity: 'guardrails',
        format: 'json',
      }),
    ).rejects.toBe(failure);
  });
});
