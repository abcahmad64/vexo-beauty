import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import type { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminAiService } from './admin-ai.service';

type QueryRawMock = jest.MockedFunction<
  (...args: unknown[]) => Promise<unknown>
>;

type ExecuteRawMock = jest.MockedFunction<
  (...args: unknown[]) => Promise<number>
>;

type PrismaMock = {
  $queryRaw: QueryRawMock;
  $executeRaw: ExecuteRawMock;
};

const createPrismaMock = (): PrismaMock => ({
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
});

const createRunRow = () => ({
  id: 'run-1',
  taskType: 'STORE_HEALTH',
  status: 'SUCCESS',
  promptTemplateId: null,
  promptKey: 'STORE_HEALTH',
  provider: 'backend',
  model: null,
  inputJson: {
    source: 'admin',
  },
  outputJson: {
    healthy: true,
  },
  guardrailResultJson: [],
  tokenUsageJson: null,
  errorMessage: null,
  durationMs: 125,
  createdById: 'admin-1',
  startedAt: new Date('2026-07-26T10:00:00.000Z'),
  finishedAt: new Date('2026-07-26T10:00:01.000Z'),
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:01.000Z'),
  deletedAt: null,
});

const createNoteRow = () => ({
  id: 'event-1',
  name: 'ai.note.created',
  description: 'یادداشت مدیریتی برای هوشمندی ثبت شد.',
  category: 'AI',
  userId: 'admin-1',
  data: {
    entityKey: 'run-1',
    note: 'یادداشت تست',
    isImportant: true,
    visibility: 'admin',
  },
  timestamp: new Date('2026-07-26T10:05:00.000Z'),
  createdAt: new Date('2026-07-26T10:05:00.000Z'),
});

describe('AdminAiService read models', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps dashboard number and bigint counters', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          status: 'SUCCESS',
          count: 12n,
        },
        {
          status: 'FAILED',
          count: 3,
        },
      ])
      .mockResolvedValueOnce([{ count: 4n }])
      .mockResolvedValueOnce([{ count: 15 }])
      .mockResolvedValueOnce([{ count: 7n }])
      .mockResolvedValueOnce([
        {
          status: 'OPEN',
          count: 9n,
        },
        {
          status: 'RESOLVED',
          count: 2,
        },
      ]);

    await expect(service.getDashboard()).resolves.toEqual({
      runsLast30Days: [
        {
          status: 'SUCCESS',
          count: 12,
        },
        {
          status: 'FAILED',
          count: 3,
        },
      ],
      activeTemplates: 4,
      activeKnowledgeDocuments: 15,
      activeGuardrails: 7,
      recommendations: [
        {
          status: 'OPEN',
          count: 9,
        },
        {
          status: 'RESOLVED',
          count: 2,
        },
      ],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('normalizes run pagination and computes metadata', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createRunRow()])
      .mockResolvedValueOnce([{ count: 41n }]);

    const result = await service.findRuns({
      page: -5,
      limit: 10_000,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'run-1',
      taskType: 'STORE_HEALTH',
      status: 'SUCCESS',
      durationMs: 125,
    });

    expect(result.meta).toEqual({
      page: 1,
      limit: 200,
      total: 41,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('computes next and previous pagination flags', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 45 }]);

    const result = await service.findRuns({
      page: 2,
      limit: 20,
    });

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it('maps one run and its associated notes', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createRunRow()])
      .mockResolvedValueOnce([createNoteRow()]);

    const result = await service.findRun('run-1', false);

    expect(result).toMatchObject({
      id: 'run-1',
      taskType: 'STORE_HEALTH',
      status: 'SUCCESS',
      notes: [
        {
          id: 'event-1',
          note: 'یادداشت تست',
          isImportant: true,
          visibility: 'admin',
          actorId: 'admin-1',
          createdAt: '2026-07-26T10:05:00.000Z',
        },
      ],
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundException when a run does not exist', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = service.findRun('missing-run', true);

    await expect(operation).rejects.toBeInstanceOf(NotFoundException);
    await expect(operation).rejects.toThrow('اجرای هوشمند موردنظر یافت نشد.');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

type AdminRunTaskInput = {
  taskType:
    | 'STORE_HEALTH_SUMMARY'
    | 'SALES_INSIGHT'
    | 'SEO_REVIEW'
    | 'SUPPORT_SUMMARY'
    | 'SEARCH_INSIGHT'
    | 'CUSTOM_PROMPT';
  promptTemplateId?: string;
  input?: Record<string, unknown>;
  model?: string;
  reason?: string;
};

type GuardrailFixture = {
  ruleId: string;
  key: string;
  title: string;
  severity: string;
  action: string;
  message: string;
};

type AdminAiDomain02Access = {
  runTask(dto: AdminRunTaskInput, actorId?: string): Promise<unknown>;

  evaluateGuardrails(
    input: Record<string, unknown>,
  ): Promise<GuardrailFixture[]>;

  executeTask(
    dto: AdminRunTaskInput,
    runId: string,
  ): Promise<Record<string, unknown>>;

  finishRun(
    runId: string,
    status: string,
    output: Record<string, unknown>,
    guardrails: GuardrailFixture[],
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void>;

  createSystemEvent(
    name: string,
    description: string,
    entityId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string>;

  generateStoreHealthSummary(): Promise<Record<string, unknown>>;

  generateSalesInsight(): Promise<Record<string, unknown>>;

  generateSeoReview(runId: string): Promise<Record<string, unknown>>;

  generateSupportSummary(): Promise<Record<string, unknown>>;

  generateSearchInsight(): Promise<Record<string, unknown>>;

  generateCustomPrompt(
    dto: AdminRunTaskInput,
  ): Promise<Record<string, unknown>>;
};

const asDomain02Access = (service: AdminAiService): AdminAiDomain02Access =>
  service as unknown as AdminAiDomain02Access;

describe('AdminAiService run task orchestration', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain02Access;

  const successfulRun: Record<string, unknown> = {
    id: 'mapped-run',
    status: 'SUCCESS',
  };

  const failedRun: Record<string, unknown> = {
    id: 'mapped-run',
    status: 'FAILED',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.$executeRaw.mockResolvedValue(1);

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain02Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('finishes a blocked run without executing its task', async () => {
    const guardrails: GuardrailFixture[] = [
      {
        ruleId: 'guardrail-1',
        key: 'blocked-content',
        title: 'Blocked content',
        severity: 'HIGH',
        action: 'BLOCK',
        message: 'Blocked by test guardrail.',
      },
    ];

    jest.spyOn(access, 'evaluateGuardrails').mockResolvedValue(guardrails);

    const executeTaskSpy = jest.spyOn(access, 'executeTask').mockResolvedValue({
      shouldNotRun: true,
    });

    const finishRunSpy = jest
      .spyOn(access, 'finishRun')
      .mockResolvedValue(undefined);

    const eventSpy = jest
      .spyOn(access, 'createSystemEvent')
      .mockResolvedValue('event-blocked');

    const findRunSpy = jest
      .spyOn(service, 'findRun')
      .mockResolvedValue(successfulRun as never);

    await expect(
      access.runTask(
        {
          taskType: 'STORE_HEALTH_SUMMARY',
          input: {
            content: 'blocked value',
          },
          reason: 'guardrail orchestration test',
        },
        'admin-1',
      ),
    ).resolves.toBe(successfulRun);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(executeTaskSpy).not.toHaveBeenCalled();

    expect(finishRunSpy).toHaveBeenCalledWith(
      expect.any(String),
      'BLOCKED',
      {
        message: 'اجرای وظیفه هوشمند به دلیل قانون امنیتی متوقف شد.',
      },
      guardrails,
      'اجرای وظیفه توسط Guardrail مسدود شد.',
      expect.any(Number),
    );

    expect(eventSpy).not.toHaveBeenCalled();

    expect(findRunSpy).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('persists success and creates its completion event', async () => {
    const output: Record<string, unknown> = {
      title: 'successful output',
    };

    jest.spyOn(access, 'evaluateGuardrails').mockResolvedValue([]);

    const executeTaskSpy = jest
      .spyOn(access, 'executeTask')
      .mockResolvedValue(output);

    const finishRunSpy = jest
      .spyOn(access, 'finishRun')
      .mockResolvedValue(undefined);

    const eventSpy = jest
      .spyOn(access, 'createSystemEvent')
      .mockResolvedValue('event-success');

    jest.spyOn(service, 'findRun').mockResolvedValue(successfulRun as never);

    const dto: AdminRunTaskInput = {
      taskType: 'SALES_INSIGHT',
      input: {
        period: '14d',
      },
      model: 'admin-model',
      reason: 'success orchestration test',
    };

    await expect(access.runTask(dto, 'admin-1')).resolves.toBe(successfulRun);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

    expect(executeTaskSpy).toHaveBeenCalledWith(dto, expect.any(String));

    expect(finishRunSpy).toHaveBeenCalledWith(
      expect.any(String),
      'SUCCESS',
      output,
      [],
      null,
      expect.any(Number),
    );

    expect(eventSpy).toHaveBeenCalledTimes(1);

    const eventCall = eventSpy.mock.calls[0];

    expect(eventCall).toBeDefined();

    if (!eventCall) {
      throw new Error('Expected createSystemEvent to be called once.');
    }

    const [
      eventName,
      eventDescription,
      eventEntityId,
      eventActorId,
      eventData,
    ] = eventCall;

    expect(eventName).toBe('ai.run.completed');
    expect(eventDescription).toBe('وظیفه هوشمند مدیریتی با موفقیت اجرا شد.');
    expect(typeof eventEntityId).toBe('string');
    expect(eventEntityId.length).toBeGreaterThan(0);
    expect(eventActorId).toBe('admin-1');

    expect(typeof eventData.runId).toBe('string');
    expect(eventData.runId).toBe(eventEntityId);
    expect(eventData.taskType).toBe('SALES_INSIGHT');
    expect(eventData.reason).toBe('success orchestration test');
  });

  it('converts an Error rejection into a failed run', async () => {
    jest.spyOn(access, 'evaluateGuardrails').mockResolvedValue([]);

    jest
      .spyOn(access, 'executeTask')
      .mockRejectedValue(new Error('generator failed'));

    const finishRunSpy = jest
      .spyOn(access, 'finishRun')
      .mockResolvedValue(undefined);

    const eventSpy = jest
      .spyOn(access, 'createSystemEvent')
      .mockResolvedValue('unused-event');

    jest.spyOn(service, 'findRun').mockResolvedValue(failedRun as never);

    await expect(
      access.runTask({
        taskType: 'SEO_REVIEW',
      }),
    ).resolves.toBe(failedRun);

    expect(finishRunSpy).toHaveBeenCalledWith(
      expect.any(String),
      'FAILED',
      {},
      [],
      'generator failed',
      expect.any(Number),
    );

    expect(eventSpy).not.toHaveBeenCalled();
  });

  it('uses the generic message for a non-Error rejection', async () => {
    jest.spyOn(access, 'evaluateGuardrails').mockResolvedValue([]);

    jest.spyOn(access, 'executeTask').mockRejectedValue('plain rejection');

    const finishRunSpy = jest
      .spyOn(access, 'finishRun')
      .mockResolvedValue(undefined);

    jest.spyOn(service, 'findRun').mockResolvedValue(failedRun as never);

    await expect(
      access.runTask({
        taskType: 'SEARCH_INSIGHT',
      }),
    ).resolves.toBe(failedRun);

    expect(finishRunSpy).toHaveBeenCalledWith(
      expect.any(String),
      'FAILED',
      {},
      [],
      'خطای نامشخص در اجرای وظیفه هوشمند',
      expect.any(Number),
    );
  });

  it('routes STORE_HEALTH_SUMMARY to its generator', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'store-health',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateStoreHealthSummary')
      .mockResolvedValue(expected);

    await expect(
      access.executeTask(
        {
          taskType: 'STORE_HEALTH_SUMMARY',
        },
        'run-route-1',
      ),
    ).resolves.toBe(expected);

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith();
  });

  it('routes SALES_INSIGHT to its generator', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'sales',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateSalesInsight')
      .mockResolvedValue(expected);

    await expect(
      access.executeTask(
        {
          taskType: 'SALES_INSIGHT',
        },
        'run-route-1',
      ),
    ).resolves.toBe(expected);

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith();
  });

  it('routes SEO_REVIEW with the current run id', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'seo',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateSeoReview')
      .mockResolvedValue(expected);

    await expect(
      access.executeTask(
        {
          taskType: 'SEO_REVIEW',
        },
        'run-route-1',
      ),
    ).resolves.toBe(expected);

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith('run-route-1');
  });

  it('routes SUPPORT_SUMMARY to its generator', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'support',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateSupportSummary')
      .mockResolvedValue(expected);

    await expect(
      access.executeTask(
        {
          taskType: 'SUPPORT_SUMMARY',
        },
        'run-route-1',
      ),
    ).resolves.toBe(expected);

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith();
  });

  it('routes SEARCH_INSIGHT to its generator', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'search',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateSearchInsight')
      .mockResolvedValue(expected);

    await expect(
      access.executeTask(
        {
          taskType: 'SEARCH_INSIGHT',
        },
        'run-route-1',
      ),
    ).resolves.toBe(expected);

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith();
  });

  it('routes CUSTOM_PROMPT with the complete DTO', async () => {
    const expected: Record<string, unknown> = {
      routedTo: 'custom',
    };

    const generatorSpy = jest
      .spyOn(access, 'generateCustomPrompt')
      .mockResolvedValue(expected);

    const dto: AdminRunTaskInput = {
      taskType: 'CUSTOM_PROMPT',
      promptTemplateId: 'template-1',
      input: {
        variables: {
          product: 'serum',
        },
      },
    };

    await expect(access.executeTask(dto, 'run-route-1')).resolves.toBe(
      expected,
    );

    expect(generatorSpy).toHaveBeenCalledTimes(1);
    expect(generatorSpy).toHaveBeenCalledWith(dto);
  });
});

type StoreHealthSummaryResult = {
  title: string;
  period: string;
  metrics: {
    orderCount: number;
    grossRevenue: string;
    successfulPaymentCount: number;
    paidRevenue: string;
    newCustomers: number;
    activeProducts: number;
    inactiveProducts: number;
    openSupportTickets: number;
  };
  warnings: string[];
  generatedAt: string;
};

type SalesInsightResult = {
  title: string;
  period: string;
  rows: Array<{
    period: string;
    orderCount: number;
    revenue: string;
  }>;
  generatedAt: string;
};

type SupportSummaryResult = {
  title: string;
  period: string;
  tickets: Array<{
    status: string;
    count: number;
  }>;
  chats: Array<{
    status: string;
    count: number;
    unreadByAdmin: number;
  }>;
  generatedAt: string;
};

type SearchInsightResult = {
  title: string;
  period: string;
  topQueries: Array<{
    query: string;
    count: number;
    averageResultCount: string;
  }>;
  generatedAt: string;
};

type SeoReviewResult = {
  title: string;
  metrics: {
    totalPages: number;
    missingMetaTitle: number;
    missingMetaDescription: number;
    noIndexCount: number;
  };
  generatedAt: string;
};

type AdminAiDomain02B1Access = {
  generateStoreHealthSummary(): Promise<StoreHealthSummaryResult>;

  generateSalesInsight(): Promise<SalesInsightResult>;

  generateSeoReview(runId: string): Promise<SeoReviewResult>;

  generateSupportSummary(): Promise<SupportSummaryResult>;

  generateSearchInsight(): Promise<SearchInsightResult>;

  createRecommendationFromRun(
    runId: string,
    targetType: string,
    targetId: string | null,
    title: string,
    message: string,
    severity: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
};

const asDomain02B1Access = (service: AdminAiService): AdminAiDomain02B1Access =>
  service as unknown as AdminAiDomain02B1Access;

describe('AdminAiService generator mappings', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain02B1Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain02B1Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps store-health metrics and adds both warnings', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 12n,
          amount: '1234.5',
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 10,
          amount: '1000',
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 7n,
        },
      ])
      .mockResolvedValueOnce([
        {
          active: 80n,
          inactive: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 21n,
        },
      ]);

    const result = await access.generateStoreHealthSummary();

    expect(result.title).toBe('خلاصه سلامت فروشگاه');
    expect(result.period).toBe('۳۰ روز اخیر');

    expect(result.metrics).toEqual({
      orderCount: 12,
      grossRevenue: '1234.50',
      successfulPaymentCount: 10,
      paidRevenue: '1000.00',
      newCustomers: 7,
      activeProducts: 80,
      inactiveProducts: 3,
      openSupportTickets: 21,
    });

    expect(result.warnings).toEqual([
      'تعداد تیکت‌های باز یا در انتظار زیاد است و نیاز به بررسی تیم پشتیبانی دارد.',
      'برخی محصولات غیرفعال هستند و ممکن است روی فروش اثر بگذارند.',
    ]);

    expect(typeof result.generatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns no store-health warnings at safe thresholds', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
          amount: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
          amount: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          active: 0,
          inactive: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 20,
        },
      ]);

    const result = await access.generateStoreHealthSummary();

    expect(result.metrics).toEqual({
      orderCount: 0,
      grossRevenue: '0.00',
      successfulPaymentCount: 0,
      paidRevenue: '0.00',
      newCustomers: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      openSupportTickets: 20,
    });

    expect(result.warnings).toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(5);
  });

  it('maps sales rows to ISO dates and decimal strings', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        period: new Date('2026-07-12T00:00:00.000Z'),
        orderCount: 4n,
        revenue: '875.5',
      },
      {
        period: new Date('2026-07-13T00:00:00.000Z'),
        orderCount: 2,
        revenue: 125,
      },
    ]);

    const result = await access.generateSalesInsight();

    expect(result.title).toBe('تحلیل فروش');
    expect(result.period).toBe('۱۴ روز اخیر');

    expect(result.rows).toEqual([
      {
        period: '2026-07-12T00:00:00.000Z',
        orderCount: 4,
        revenue: '875.50',
      },
      {
        period: '2026-07-13T00:00:00.000Z',
        orderCount: 2,
        revenue: '125.00',
      },
    ]);

    expect(typeof result.generatedAt).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('maps support ticket and chat counters', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          status: 'OPEN',
          count: 8n,
        },
        {
          status: 'RESOLVED',
          count: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          status: 'ACTIVE',
          count: 3n,
          unreadByAdmin: 6n,
        },
        {
          status: 'CLOSED',
          count: 9,
          unreadByAdmin: 0,
        },
      ]);

    const result = await access.generateSupportSummary();

    expect(result.title).toBe('خلاصه پشتیبانی');
    expect(result.period).toBe('۳۰ روز اخیر');

    expect(result.tickets).toEqual([
      {
        status: 'OPEN',
        count: 8,
      },
      {
        status: 'RESOLVED',
        count: 5,
      },
    ]);

    expect(result.chats).toEqual([
      {
        status: 'ACTIVE',
        count: 3,
        unreadByAdmin: 6,
      },
      {
        status: 'CLOSED',
        count: 9,
        unreadByAdmin: 0,
      },
    ]);

    expect(typeof result.generatedAt).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('maps search query counts and average result values', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        normalizedQuery: 'ضد آفتاب',
        count: 14n,
        averageResultCount: '3.75',
      },
      {
        normalizedQuery: 'سرم پوست',
        count: 6,
        averageResultCount: 2,
      },
    ]);

    const result = await access.generateSearchInsight();

    expect(result.title).toBe('تحلیل جست‌وجوی کاربران');

    expect(result.period).toBe('۳۰ روز اخیر');

    expect(result.topQueries).toEqual([
      {
        query: 'ضد آفتاب',
        count: 14,
        averageResultCount: '3.75',
      },
      {
        query: 'سرم پوست',
        count: 6,
        averageResultCount: '2.00',
      },
    ]);

    expect(typeof result.generatedAt).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('creates a high-severity SEO recommendation when titles are missing', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        total: 30n,
        missingMetaTitle: 4n,
        missingMetaDescription: 7,
        noIndexCount: 2n,
      },
    ]);

    const recommendationSpy = jest
      .spyOn(access, 'createRecommendationFromRun')
      .mockResolvedValue(undefined);

    const result = await access.generateSeoReview('run-seo-1');

    expect(result.title).toBe('بازبینی سئو');

    expect(result.metrics).toEqual({
      totalPages: 30,
      missingMetaTitle: 4,
      missingMetaDescription: 7,
      noIndexCount: 2,
    });

    expect(recommendationSpy).toHaveBeenCalledWith(
      'run-seo-1',
      'SEO',
      null,
      'صفحات بدون Meta Title',
      'برخی صفحات محتوایی عنوان سئو ندارند. بهتر است برای افزایش کیفیت نتایج جست‌وجو تکمیل شوند.',
      'HIGH',
      {
        missingMetaTitle: 4,
      },
    );

    expect(typeof result.generatedAt).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not create an SEO recommendation when no title is missing', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        total: 12,
        missingMetaTitle: 0,
        missingMetaDescription: 1,
        noIndexCount: 0,
      },
    ]);

    const recommendationSpy = jest
      .spyOn(access, 'createRecommendationFromRun')
      .mockResolvedValue(undefined);

    const result = await access.generateSeoReview('run-seo-2');

    expect(result.metrics).toEqual({
      totalPages: 12,
      missingMetaTitle: 0,
      missingMetaDescription: 1,
      noIndexCount: 0,
    });

    expect(recommendationSpy).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

type PromptTemplateFixture = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  variablesJson: unknown;
  model: string | null;
  temperature: unknown;
  maxTokens: number | null;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type GuardrailRuleFixture = {
  id: string;
  key: string;
  title: string;
  pattern: string | null;
  severity: string;
  action: string;
  message: string | null;
  isActive: boolean;
  ruleType: string;
  priority: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CustomPromptResult = {
  title: string;
  template: {
    id: string;
    key: string;
    title: string;
    model: string | null;
  };
  renderedPrompt: {
    system: string;
    user: string;
  };
  variables: Record<string, unknown>;
  status: string;
  generatedAt: string;
};

type DecimalLike = {
  toString(): string;
};

type SqlLike = {
  strings?: readonly string[];
  values?: readonly unknown[];
};

type AdminAiDomain02B2Access = {
  evaluateGuardrails(
    input: Record<string, unknown>,
  ): Promise<GuardrailFixture[]>;

  generateCustomPrompt(dto: AdminRunTaskInput): Promise<CustomPromptResult>;

  finishRun(
    runId: string,
    status: string,
    output: Record<string, unknown>,
    guardrails: GuardrailFixture[],
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void>;

  createRecommendationFromRun(
    runId: string,
    targetType: string,
    targetId: string | null,
    title: string,
    message: string,
    severity: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;

  scoreFromSeverity(severity: string): DecimalLike;
};

const asDomain02B2Access = (service: AdminAiService): AdminAiDomain02B2Access =>
  service as unknown as AdminAiDomain02B2Access;

const asSqlLike = (value: unknown): SqlLike => {
  if (value && typeof value === 'object') {
    return value;
  }

  return {};
};

const hasDecimalStringifier = (value: unknown): value is DecimalLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate: {
    toString?: unknown;
  } = value;

  return typeof candidate.toString === 'function';
};

const requireExecuteRawSql = (prisma: PrismaMock): SqlLike => {
  const call = prisma.$executeRaw.mock.calls[0];

  expect(call).toBeDefined();

  if (!call) {
    throw new Error('Expected Prisma $executeRaw to be called.');
  }

  return asSqlLike(call[0]);
};

const createPromptTemplateFixture = (
  overrides: Partial<PromptTemplateFixture> = {},
): PromptTemplateFixture => ({
  id: 'template-1',
  key: 'catalog-copy',
  title: 'Catalog copy',
  description: null,
  taskType: 'CUSTOM_PROMPT',
  systemPrompt: 'System {{brand}} {{count}} {{enabled}} {{missing}} {{object}}',
  userPrompt: 'User {{product}} {{large}} {{items}} {{nullable}}',
  variablesJson: {},
  model: 'template-model',
  temperature: '0.2',
  maxTokens: 1200,
  status: 'ACTIVE',
  createdById: 'admin-1',
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

const createGuardrailRuleFixture = (
  overrides: Partial<GuardrailRuleFixture> = {},
): GuardrailRuleFixture => ({
  id: 'rule-1',
  key: 'SENSITIVE_DATA',
  title: 'Sensitive data',
  pattern: 'secret',
  severity: 'HIGH',
  action: 'BLOCK',
  message: 'Sensitive value detected.',
  isActive: true,
  ruleType: 'SENSITIVE_DATA',
  priority: 90,
  createdById: 'admin-1',
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AdminAiService guardrails and helpers', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain02B2Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain02B2Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps matching guardrails and uses the fallback message', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createGuardrailRuleFixture(),
      createGuardrailRuleFixture({
        id: 'rule-2',
        key: 'REVIEW_ONLY',
        title: 'Review only',
        pattern: 'review-me',
        severity: 'MEDIUM',
        action: 'REVIEW',
        message: null,
      }),
      createGuardrailRuleFixture({
        id: 'rule-3',
        pattern: 'does-not-match',
      }),
      createGuardrailRuleFixture({
        id: 'rule-4',
        pattern: null,
      }),
    ]);

    const result = await access.evaluateGuardrails({
      content: 'Contains SECRET and review-me.',
    });

    expect(result).toEqual([
      {
        ruleId: 'rule-1',
        key: 'SENSITIVE_DATA',
        title: 'Sensitive data',
        severity: 'HIGH',
        action: 'BLOCK',
        message: 'Sensitive value detected.',
      },
      {
        ruleId: 'rule-2',
        key: 'REVIEW_ONLY',
        title: 'Review only',
        severity: 'MEDIUM',
        action: 'REVIEW',
        message: 'درخواست با قانون محافظ هوشمند تطبیق دارد.',
      },
    ]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates SyntaxError for an invalid guardrail regex', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createGuardrailRuleFixture({
        pattern: '[',
      }),
    ]);

    await expect(
      access.evaluateGuardrails({
        content: 'anything',
      }),
    ).rejects.toBeInstanceOf(SyntaxError);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a custom prompt without a template id', async () => {
    await expect(
      access.generateCustomPrompt({
        taskType: 'CUSTOM_PROMPT',
      }),
    ).rejects.toEqual(
      new BadRequestException(
        'برای اجرای پرامپت سفارشی، شناسه قالب پرامپت الزامی است.',
      ),
    );

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects an inactive custom-prompt template', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createPromptTemplateFixture({
        status: 'DRAFT',
      }),
    ]);

    await expect(
      access.generateCustomPrompt({
        taskType: 'CUSTOM_PROMPT',
        promptTemplateId: 'template-1',
      }),
    ).rejects.toEqual(
      new BadRequestException('قالب پرامپت انتخاب‌شده فعال نیست.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('renders scalar variables and uses the template model', async () => {
    prisma.$queryRaw.mockResolvedValue([createPromptTemplateFixture()]);

    const variables: Record<string, unknown> = {
      brand: 'VEXO',
      product: 'Serum',
      count: 3,
      large: 9007199254740993n,
      enabled: true,
      missing: undefined,
      nullable: null,
      object: {
        nested: true,
      },
      items: ['one', 'two'],
    };

    const result = await access.generateCustomPrompt({
      taskType: 'CUSTOM_PROMPT',
      promptTemplateId: 'template-1',
      input: {
        variables,
      },
    });

    expect(result.title).toBe('پرامپت سفارشی آماده اجرا');

    expect(result.template).toEqual({
      id: 'template-1',
      key: 'catalog-copy',
      title: 'Catalog copy',
      model: 'template-model',
    });

    expect(result.renderedPrompt).toEqual({
      system: 'System VEXO 3 true  ',
      user: 'User Serum 9007199254740993  ',
    });

    expect(result.variables).toBe(variables);
    expect(result.status).toBe('READY_FOR_PROVIDER');
    expect(typeof result.generatedAt).toBe('string');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('uses the DTO model override and empty variables for invalid input', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createPromptTemplateFixture({
        systemPrompt: 'System {{name}}',
        userPrompt: 'User {{name}}',
      }),
    ]);

    const result = await access.generateCustomPrompt({
      taskType: 'CUSTOM_PROMPT',
      promptTemplateId: 'template-1',
      model: 'override-model',
      input: {
        variables: ['not', 'a', 'record'],
      },
    });

    expect(result.template.model).toBe('override-model');

    expect(result.renderedPrompt).toEqual({
      system: 'System ',
      user: 'User ',
    });

    expect(result.variables).toEqual({});
  });

  it('persists a completed run with merged guardrails', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    const guardrails: GuardrailFixture[] = [
      {
        ruleId: 'rule-1',
        key: 'SENSITIVE_DATA',
        title: 'Sensitive data',
        severity: 'HIGH',
        action: 'BLOCK',
        message: 'Sensitive value detected.',
      },
    ];

    await access.finishRun(
      'run-1',
      'SUCCESS',
      {
        answer: 'completed',
      },
      guardrails,
      null,
      275,
    );

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

    const sql = requireExecuteRawSql(prisma);
    const values = sql.values ?? [];

    expect(values).toContain('SUCCESS');
    expect(values).toContain('run-1');
    expect(values).toContain(null);
    expect(values).toContain(275);

    expect(values).toContain(
      JSON.stringify({
        answer: 'completed',
        _guardrails: guardrails,
      }),
    );
  });

  it.each([
    ['CRITICAL', '1'],
    ['HIGH', '0.85'],
    ['LOW', '0.35'],
    ['MEDIUM', '0.6'],
    ['unknown', '0.6'],
  ])('maps %s severity to score %s', (severity, expected) => {
    expect(access.scoreFromSeverity(severity).toString()).toBe(expected);
  });

  it.each([
    {
      targetType: 'PRODUCT',
      targetId: 'product-1',
      expectedProductId: 'product-1',
      expectedUserId: null,
      severity: 'CRITICAL',
      expectedScore: '1',
    },
    {
      targetType: 'USER',
      targetId: 'user-1',
      expectedProductId: null,
      expectedUserId: 'user-1',
      severity: 'LOW',
      expectedScore: '0.35',
    },
    {
      targetType: 'SEO',
      targetId: 'page-1',
      expectedProductId: null,
      expectedUserId: null,
      severity: 'MEDIUM',
      expectedScore: '0.6',
    },
  ])(
    'persists recommendation target $targetType',
    async ({
      targetType,
      targetId,
      expectedProductId,
      expectedUserId,
      severity,
      expectedScore,
    }) => {
      prisma.$executeRaw.mockResolvedValue(1);

      await access.createRecommendationFromRun(
        'run-recommendation-1',
        targetType,
        targetId,
        'Recommendation title',
        'Recommendation message',
        severity,
        {
          source: 'test',
        },
      );

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

      const sql = requireExecuteRawSql(prisma);
      const values = sql.values ?? [];

      expect(values).toContain(targetType);
      expect(values).toContain(expectedProductId);
      expect(values).toContain(expectedUserId);
      expect(values).toContain('Recommendation message');

      const metadataJson = JSON.stringify({
        source: 'test',
        title: 'Recommendation title',
        message: 'Recommendation message',
        severity,
        adminStatus: 'OPEN',
        createdByRunId: 'run-recommendation-1',
      });

      expect(values).toContain(metadataJson);

      const decimalValue = values.find(
        (value): value is DecimalLike =>
          hasDecimalStringifier(value) && value.toString() === expectedScore,
      );

      expect(decimalValue).toBeDefined();
    },
  );
});

type TemplateRowFixture = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  variablesJson: unknown;
  model: string | null;
  temperature: unknown;
  maxTokens: number | null;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type TemplateReadQuery = {
  q?: string;
  key?: string;
  taskType?:
    | 'STORE_HEALTH_SUMMARY'
    | 'SALES_INSIGHT'
    | 'SEO_REVIEW'
    | 'SUPPORT_SUMMARY'
    | 'SEARCH_INSIGHT'
    | 'CUSTOM_PROMPT';
  templateStatus?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  includeDeleted?: boolean;
};

type TemplateReadResult = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
  model: string | null;
  temperature: string | null;
  maxTokens: number | null;
  status: string;
  createdById: string | null;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

type AdminAiDomain03A1Access = {
  findTemplates(query: TemplateReadQuery): Promise<{
    data: TemplateReadResult[];
    meta: {
      total: number;
    };
  }>;

  findTemplate(
    templateId: string,
    includeDeleted?: boolean,
  ): Promise<TemplateReadResult>;
};

const asDomain03A1Access = (service: AdminAiService): AdminAiDomain03A1Access =>
  service as unknown as AdminAiDomain03A1Access;

const createTemplateRowFixture = (
  overrides: Partial<TemplateRowFixture> = {},
): TemplateRowFixture => ({
  id: 'template-read-1',
  key: 'catalog_copy',
  title: 'Catalog copy',
  description: 'Template description',
  taskType: 'CUSTOM_PROMPT',
  systemPrompt: 'System prompt',
  userPrompt: 'User prompt',
  variablesJson: ['brand', 'product', 'brand', 17],
  model: 'template-model',
  temperature: '0.25',
  maxTokens: 1500,
  status: 'ACTIVE',
  createdById: 'admin-1',
  createdAt: new Date('2026-07-20T08:30:00.000Z'),
  updatedAt: new Date('2026-07-21T09:45:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AdminAiService prompt template reads', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain03A1Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain03A1Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps template rows while preserving duplicate strings', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createTemplateRowFixture(),
      createTemplateRowFixture({
        id: 'template-read-2',
        key: 'sales_summary',
        title: 'Sales summary',
        description: null,
        taskType: 'SALES_INSIGHT',
        variablesJson: ['period'],
        model: null,
        temperature: null,
        maxTokens: null,
        status: 'DRAFT',
        createdById: null,
        deletedAt: new Date('2026-07-22T10:15:00.000Z'),
      }),
    ]);

    const result = await access.findTemplates({
      includeDeleted: true,
    });

    expect(result.meta).toEqual({
      total: 2,
    });

    expect(result.data).toHaveLength(2);

    expect(result.data[0]).toMatchObject({
      id: 'template-read-1',
      key: 'catalog_copy',
      title: 'Catalog copy',
      description: 'Template description',
      taskType: 'CUSTOM_PROMPT',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
      variables: ['brand', 'product', 'brand'],
      model: 'template-model',
      temperature: '0.25',
      maxTokens: 1500,
      status: 'ACTIVE',
      createdById: 'admin-1',
      createdAt: '2026-07-20T08:30:00.000Z',
      updatedAt: '2026-07-21T09:45:00.000Z',
      deletedAt: null,
    });

    expect(typeof result.data[0]?.createdAtFa).toBe('string');
    expect(typeof result.data[0]?.updatedAtFa).toBe('string');
    expect(result.data[0]?.deletedAtFa).toBeNull();

    expect(result.data[1]).toMatchObject({
      id: 'template-read-2',
      variables: ['period'],
      model: null,
      temperature: null,
      maxTokens: null,
      status: 'DRAFT',
      createdById: null,
      deletedAt: '2026-07-22T10:15:00.000Z',
    });

    expect(typeof result.data[1]?.deletedAtFa).toBe('string');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns an empty list and zero total', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(access.findTemplates({})).resolves.toEqual({
      data: [],
      meta: {
        total: 0,
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('passes normalized template filters to SQL', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findTemplates({
      q: 'beauty',
      key: '  Product Copy  ',
      taskType: 'CUSTOM_PROMPT',
      templateStatus: 'ACTIVE',
    });

    const call = prisma.$queryRaw.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected Prisma $queryRaw to be called.');
    }

    const sql = asSqlLike(call[0]);
    const values = sql.values ?? [];
    const sqlText = (sql.strings ?? []).join(' ');

    expect(values).toContain('%beauty%');
    expect(values).toContain('%product_copy%');
    expect(values).toContain('CUSTOM_PROMPT');
    expect(values).toContain('ACTIVE');

    expect(sqlText).toContain('t."deleted_at" IS NULL');
  });

  it('omits the deleted filter when includeDeleted is true', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findTemplates({
      includeDeleted: true,
    });

    const call = prisma.$queryRaw.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected Prisma $queryRaw to be called.');
    }

    const sql = asSqlLike(call[0]);

    expect((sql.strings ?? []).join(' ')).not.toContain(
      't."deleted_at" IS NULL',
    );
  });

  it('maps one deleted template when inclusion is allowed', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createTemplateRowFixture({
        id: 'template-deleted-1',
        deletedAt: new Date('2026-07-23T11:20:00.000Z'),
      }),
    ]);

    const result = await access.findTemplate('template-deleted-1', true);

    expect(result).toMatchObject({
      id: 'template-deleted-1',
      key: 'catalog_copy',
      variables: ['brand', 'product', 'brand'],
      temperature: '0.25',
      deletedAt: '2026-07-23T11:20:00.000Z',
    });

    expect(typeof result.deletedAtFa).toBe('string');

    const call = prisma.$queryRaw.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected Prisma $queryRaw to be called.');
    }

    const sql = asSqlLike(call[0]);

    expect(sql.values ?? []).toContain('template-deleted-1');

    expect((sql.strings ?? []).join(' ')).not.toContain(
      't."deleted_at" IS NULL',
    );
  });

  it('excludes deleted rows when findTemplate receives false', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createTemplateRowFixture({
        id: 'template-active-1',
      }),
    ]);

    await access.findTemplate('template-active-1', false);

    const call = prisma.$queryRaw.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected Prisma $queryRaw to be called.');
    }

    const sql = asSqlLike(call[0]);

    expect((sql.strings ?? []).join(' ')).toContain('t."deleted_at" IS NULL');
  });

  it('throws NotFoundException when a template is absent', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      access.findTemplate('missing-template', false),
    ).rejects.toEqual(new NotFoundException('قالب پرامپت هوشمند یافت نشد.'));

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

type TemplateMutationInput = {
  key?: string;
  title?: string;
  description?: string;
  taskType?:
    | 'STORE_HEALTH_SUMMARY'
    | 'SALES_INSIGHT'
    | 'SEO_REVIEW'
    | 'SUPPORT_SUMMARY'
    | 'SEARCH_INSIGHT'
    | 'CUSTOM_PROMPT';
  systemPrompt?: string;
  userPrompt?: string;
  variables?: string[];
  model?: string;
  temperature?: string;
  maxTokens?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
};

type AdminAiDomain03A2Access = {
  createTemplate(
    dto: TemplateMutationInput & {
      key: string;
      title: string;
      taskType:
        | 'STORE_HEALTH_SUMMARY'
        | 'SALES_INSIGHT'
        | 'SEO_REVIEW'
        | 'SUPPORT_SUMMARY'
        | 'SEARCH_INSIGHT'
        | 'CUSTOM_PROMPT';
      systemPrompt: string;
      userPrompt: string;
    },
    actorId?: string,
  ): Promise<{
    template: TemplateReadResult;
  }>;

  updateTemplate(
    templateId: string,
    dto: TemplateMutationInput,
    actorId?: string,
  ): Promise<{
    template: TemplateReadResult;
  }>;

  deleteTemplate(
    templateId: string,
    actorId?: string,
  ): Promise<{
    success: boolean;
    message: string;
  }>;

  restoreTemplate(
    templateId: string,
    actorId?: string,
  ): Promise<{
    template: TemplateReadResult;
  }>;
};

const asDomain03A2Access = (service: AdminAiService): AdminAiDomain03A2Access =>
  service as unknown as AdminAiDomain03A2Access;

const requireRawCall = (
  mock: ExecuteRawMock | QueryRawMock,
  index: number,
): SqlLike => {
  const call = mock.mock.calls[index];

  expect(call).toBeDefined();

  if (!call) {
    throw new Error(`Expected raw Prisma call at index ${index}.`);
  }

  return asSqlLike(call[0]);
};

const rawValues = (
  mock: ExecuteRawMock | QueryRawMock,
  index: number,
): readonly unknown[] => requireRawCall(mock, index).values ?? [];

const rawText = (mock: ExecuteRawMock | QueryRawMock, index: number): string =>
  (requireRawCall(mock, index).strings ?? []).join(' ');

describe('AdminAiService prompt template mutations', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain03A2Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain03A2Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a template with normalized key and defaults', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          id: 'created-template-1',
          key: 'product_copy',
          title: 'Product copy',
          description: null,
          variablesJson: [],
          model: null,
          temperature: null,
          maxTokens: null,
          status: 'DRAFT',
          createdById: null,
        }),
      ]);

    prisma.$executeRaw.mockResolvedValue(1);

    const result = await access.createTemplate({
      key: '  Product Copy  ',
      title: 'Product copy',
      taskType: 'CUSTOM_PROMPT',
      systemPrompt: 'System',
      userPrompt: 'User',
    });

    expect(result.template).toMatchObject({
      id: 'created-template-1',
      key: 'product_copy',
      variables: [],
      model: null,
      temperature: null,
      maxTokens: null,
      status: 'DRAFT',
      createdById: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const uniquenessValues = rawValues(prisma.$queryRaw, 0);

    expect(uniquenessValues).toContain('product_copy');

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('product_copy');
    expect(insertValues).toContain('Product copy');
    expect(insertValues).toContain('CUSTOM_PROMPT');
    expect(insertValues).toContain('System');
    expect(insertValues).toContain('User');
    expect(insertValues).toContain(JSON.stringify([]));
    expect(insertValues).toContain('DRAFT');

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'INSERT INTO "AiPromptTemplate"',
    );

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.template.created');
    expect(eventValues).toContain('قالب پرامپت هوشمند توسط ادمین ایجاد شد.');
  });

  it('creates a template with normalized variables and explicit fields', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          id: 'created-template-2',
          key: 'seo_copy',
          variablesJson: ['brand', 'product'],
          model: 'primary-model',
          temperature: '0.4',
          maxTokens: 2400,
          status: 'ACTIVE',
          createdById: 'admin-create-1',
        }),
      ]);

    prisma.$executeRaw.mockResolvedValue(1);

    const result = await access.createTemplate(
      {
        key: 'SEO Copy',
        title: 'SEO copy',
        description: 'SEO description',
        taskType: 'SEO_REVIEW',
        systemPrompt: 'System SEO',
        userPrompt: 'User SEO',
        variables: [' brand ', '', 'product', 'brand'],
        model: 'primary-model',
        temperature: '0.4',
        maxTokens: 2400,
        status: 'ACTIVE',
      },
      'admin-create-1',
    );

    expect(result.template).toMatchObject({
      id: 'created-template-2',
      key: 'seo_copy',
      variables: ['brand', 'product'],
      model: 'primary-model',
      temperature: '0.40',
      maxTokens: 2400,
      status: 'ACTIVE',
      createdById: 'admin-create-1',
    });

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('seo_copy');
    expect(insertValues).toContain('SEO description');
    expect(insertValues).toContain(JSON.stringify(['brand', 'product']));
    expect(insertValues).toContain('primary-model');
    expect(insertValues).toContain(2400);
    expect(insertValues).toContain('ACTIVE');
    expect(insertValues).toContain('admin-create-1');

    const decimalValue = insertValues.find(
      (value): value is DecimalLike =>
        hasDecimalStringifier(value) && value.toString() === '0.4',
    );

    expect(decimalValue).toBeDefined();

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.template.created');
    expect(eventValues).toContain('admin-create-1');
  });

  it('rejects a duplicate template key', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        count: 1,
      },
    ]);

    await expect(
      access.createTemplate({
        key: 'Existing Key',
        title: 'Existing',
        taskType: 'CUSTOM_PROMPT',
        systemPrompt: 'System',
        userPrompt: 'User',
      }),
    ).rejects.toEqual(new ConflictException('کلید قالب پرامپت تکراری است.'));

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();

    expect(rawValues(prisma.$queryRaw, 0)).toContain('existing_key');
  });

  it('rejects an empty template update', async () => {
    prisma.$queryRaw.mockResolvedValue([createTemplateRowFixture()]);

    await expect(
      access.updateTemplate('template-read-1', {}, 'admin-update-1'),
    ).rejects.toEqual(
      new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قالب پرامپت ارسال نشده است.',
      ),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('updates the same normalized key without a uniqueness query', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          key: 'catalog_copy',
        }),
      ])
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          title: 'Updated title',
        }),
      ]);

    prisma.$executeRaw.mockResolvedValue(1);

    const result = await access.updateTemplate(
      'template-read-1',
      {
        key: ' Catalog Copy ',
        title: 'Updated title',
      },
      'admin-update-1',
    );

    expect(result.template.title).toBe('Updated title');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateValues).toContain('catalog_copy');
    expect(updateValues).toContain('Updated title');
    expect(updateValues).toContain('template-read-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.template.updated');

    expect(eventValues).toContain(
      JSON.stringify({
        entityId: 'template-read-1',
        templateId: 'template-read-1',
        changedFields: ['key', 'title'],
      }),
    );
  });

  it('checks uniqueness when the normalized key changes', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          key: 'catalog_copy',
        }),
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          key: 'catalog_copy_v2',
        }),
      ]);

    prisma.$executeRaw.mockResolvedValue(1);

    const result = await access.updateTemplate(
      'template-read-1',
      {
        key: ' Catalog Copy V2 ',
        variables: [' brand ', '', 'product', 'brand'],
        temperature: '0.55',
        status: 'ARCHIVED',
      },
      'admin-update-2',
    );

    expect(result.template.key).toBe('catalog_copy_v2');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const uniquenessValues = rawValues(prisma.$queryRaw, 1);

    expect(uniquenessValues).toContain('catalog_copy_v2');
    expect(uniquenessValues).toContain('template-read-1');

    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateValues).toContain('catalog_copy_v2');
    expect(updateValues).toContain(JSON.stringify(['brand', 'product']));
    expect(updateValues).toContain('ARCHIVED');

    const decimalValue = updateValues.find(
      (value): value is DecimalLike =>
        hasDecimalStringifier(value) && value.toString() === '0.55',
    );

    expect(decimalValue).toBeDefined();

    expect(rawValues(prisma.$executeRaw, 1)).toContain(
      JSON.stringify({
        entityId: 'template-read-1',
        templateId: 'template-read-1',
        changedFields: ['key', 'variables', 'temperature', 'status'],
      }),
    );
  });

  it('soft-deletes a template and creates its event', async () => {
    prisma.$queryRaw.mockResolvedValue([createTemplateRowFixture()]);

    prisma.$executeRaw.mockResolvedValue(1);

    await expect(
      access.deleteTemplate('template-read-1', 'admin-delete-1'),
    ).resolves.toEqual({
      success: true,
      message: 'قالب پرامپت با موفقیت حذف شد.',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'UPDATE "AiPromptTemplate"',
    );

    const deleteValues = rawValues(prisma.$executeRaw, 0);

    expect(deleteValues).toContain('template-read-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.template.deleted');
    expect(eventValues).toContain('admin-delete-1');
  });

  it('restores a template and returns its mapped result', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          deletedAt: new Date('2026-07-24T09:00:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([
        createTemplateRowFixture({
          deletedAt: null,
        }),
      ]);

    prisma.$executeRaw.mockResolvedValue(1);

    const result = await access.restoreTemplate(
      'template-read-1',
      'admin-restore-1',
    );

    expect(result.template).toMatchObject({
      id: 'template-read-1',
      deletedAt: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'UPDATE "AiPromptTemplate"',
    );

    const restoreValues = rawValues(prisma.$executeRaw, 0);

    expect(restoreValues).toContain('template-read-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.template.restored');
    expect(eventValues).toContain('admin-restore-1');
  });

  it.each([
    ['update', 'updateTemplate'],
    ['delete', 'deleteTemplate'],
    ['restore', 'restoreTemplate'],
  ] as const)(
    'propagates NotFoundException from %s',
    async (_label, methodName) => {
      prisma.$queryRaw.mockResolvedValue([]);

      let operation: Promise<unknown>;

      if (methodName === 'updateTemplate') {
        operation = access.updateTemplate('missing-template', {
          title: 'Updated',
        });
      } else if (methodName === 'deleteTemplate') {
        operation = access.deleteTemplate('missing-template');
      } else {
        operation = access.restoreTemplate('missing-template');
      }

      await expect(operation).rejects.toEqual(
        new NotFoundException('قالب پرامپت هوشمند یافت نشد.'),
      );

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    },
  );
});

type KnowledgeRowFixture = {
  id: string;
  key: string;
  title: string;
  sourceType: string;
  language: string;
  content: string;
  tagsJson: unknown;
  metadata: unknown;
  isActive: boolean;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type KnowledgeReadResult = {
  id: string;
  key: string;
  title: string;
  sourceType: string;
  language: string;
  content: string;
  tags: string[];
  metadata: unknown;
  isActive: boolean;
  status: string;
  createdById: string | null;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

type KnowledgeQueryInput = {
  q?: string;
  key?: string;
  language?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
};

type AdminAiDomain03B1Access = {
  findKnowledge(query: KnowledgeQueryInput): Promise<{
    data: KnowledgeReadResult[];
    meta: {
      total: number;
    };
  }>;

  findKnowledgeDocument(
    documentId: string,
    includeDeleted?: boolean,
  ): Promise<KnowledgeReadResult>;
};

const asDomain03B1Access = (service: AdminAiService): AdminAiDomain03B1Access =>
  service as unknown as AdminAiDomain03B1Access;

const createKnowledgeRowFixture = (
  overrides: Partial<KnowledgeRowFixture> = {},
): KnowledgeRowFixture => ({
  id: 'knowledge-1',
  key: 'returns_policy',
  title: 'Returns policy',
  sourceType: 'POLICY',
  language: 'fa',
  content: 'Policy content',
  tagsJson: ['returns', 'policy'],
  metadata: {},
  isActive: true,
  status: 'ACTIVE',
  createdById: 'admin-knowledge-1',
  createdAt: new Date('2026-07-25T08:00:00.000Z'),
  updatedAt: new Date('2026-07-25T09:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AdminAiService knowledge reads', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain03B1Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain03B1Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps knowledge rows while preserving duplicate strings', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createKnowledgeRowFixture({
        tagsJson: ['returns', 7, 'policy', 'returns', null],
        metadata: {
          scope: 'store',
        },
      }),
    ]);

    const result = await access.findKnowledge({});
    const knowledge = result.data[0];

    expect(knowledge).toBeDefined();

    if (!knowledge) {
      throw new Error('Expected one mapped knowledge document.');
    }

    expect(knowledge).toMatchObject({
      id: 'knowledge-1',
      key: 'returns_policy',
      title: 'Returns policy',
      sourceType: 'POLICY',
      language: 'fa',
      content: 'Policy content',
      tags: ['returns', 'policy', 'returns'],
      metadata: {
        scope: 'store',
      },
      isActive: true,
      status: 'ACTIVE',
      createdById: 'admin-knowledge-1',
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T09:00:00.000Z',
      deletedAt: null,
      deletedAtFa: null,
    });

    expect(typeof knowledge.createdAtFa).toBe('string');
    expect(typeof knowledge.updatedAtFa).toBe('string');

    expect(result.meta).toEqual({
      total: 1,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns an empty knowledge list and zero total', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(access.findKnowledge({})).resolves.toEqual({
      data: [],
      meta: {
        total: 0,
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('passes normalized knowledge filters to SQL', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findKnowledge({
      q: 'return',
      key: ' Returns Policy ',
      language: ' FA ',
      isActive: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    const values = rawValues(prisma.$queryRaw, 0);
    const sql = rawText(prisma.$queryRaw, 0);

    expect(values).toContain('%return%');
    expect(values).toContain('%returns_policy%');
    expect(values).toContain('fa');
    expect(values).toContain('DRAFT');

    expect(sql).toContain('k."key" ILIKE');
    expect(sql).toContain('k."title" ILIKE');
    expect(sql).toContain('k."content" ILIKE');
    expect(sql).toContain('k."language" =');
    expect(sql).toContain('k."status" =');
    expect(sql).toContain('k."deleted_at" IS NULL');
  });

  it('omits the deleted filter when includeDeleted is true', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findKnowledge({
      includeDeleted: true,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'k."deleted_at" IS NULL',
    );
  });

  it('maps one deleted knowledge document when inclusion is allowed', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createKnowledgeRowFixture({
        deletedAt: new Date('2026-07-25T10:00:00.000Z'),
      }),
    ]);

    const result = await access.findKnowledgeDocument('knowledge-1', true);

    expect(result).toMatchObject({
      id: 'knowledge-1',
      deletedAt: '2026-07-25T10:00:00.000Z',
    });

    expect(typeof result.deletedAtFa).toBe('string');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'k."deleted_at" IS NULL',
    );
  });

  it('excludes deleted rows when findKnowledgeDocument receives false', async () => {
    prisma.$queryRaw.mockResolvedValue([createKnowledgeRowFixture()]);

    await access.findKnowledgeDocument('knowledge-1', false);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawText(prisma.$queryRaw, 0)).toContain('k."deleted_at" IS NULL');

    expect(rawValues(prisma.$queryRaw, 0)).toContain('knowledge-1');
  });

  it('throws NotFoundException when a knowledge document is absent', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.findKnowledgeDocument('missing-knowledge', true);

    await expect(operation).rejects.toEqual(
      new NotFoundException('سند دانش هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

type KnowledgeCreateInput = {
  key: string;
  title: string;
  sourceType:
    'MANUAL' | 'CMS' | 'PRODUCT' | 'POLICY' | 'FAQ' | 'URL' | undefined;
  language: string | undefined;
  content: string;
  tags: string[] | undefined;
  metadata: Record<string, unknown> | undefined;
  isActive: boolean | undefined;
};

type KnowledgeUpdateInput = {
  key?: string;
  title?: string;
  sourceType?: 'MANUAL' | 'CMS' | 'PRODUCT' | 'POLICY' | 'FAQ' | 'URL';
  language?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isActive?: boolean;
};

type KnowledgeMutationResult = {
  knowledge: KnowledgeReadResult;
};

type KnowledgeDeleteResult = {
  success: boolean;
  message: string;
};

type AdminAiDomain03B2Access = {
  createKnowledge(
    dto: KnowledgeCreateInput,
    actorId?: string,
  ): Promise<KnowledgeMutationResult>;

  updateKnowledge(
    documentId: string,
    dto: KnowledgeUpdateInput,
    actorId?: string,
  ): Promise<KnowledgeMutationResult>;

  deleteKnowledge(
    documentId: string,
    actorId?: string,
  ): Promise<KnowledgeDeleteResult>;

  restoreKnowledge(
    documentId: string,
    actorId?: string,
  ): Promise<KnowledgeMutationResult>;
};

const asDomain03B2Access = (service: AdminAiService): AdminAiDomain03B2Access =>
  service as unknown as AdminAiDomain03B2Access;

const createKnowledgeInput = (
  overrides: Partial<KnowledgeCreateInput> = {},
): KnowledgeCreateInput => ({
  key: 'Returns Policy',
  title: 'Returns policy',
  sourceType: undefined,
  language: undefined,
  content: 'Policy content',
  tags: undefined,
  metadata: undefined,
  isActive: undefined,
  ...overrides,
});

describe('AdminAiService knowledge mutations', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain03B2Access;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain03B2Access(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates knowledge with normalized defaults and anonymous actor', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'returns_policy',
          sourceType: 'MANUAL',
          language: 'fa',
          tagsJson: ['returns', 'policy'],
          status: 'ACTIVE',
          isActive: true,
          createdById: null,
        }),
      ]);

    const result = await access.createKnowledge(
      createKnowledgeInput({
        key: ' Returns Policy ',
        tags: [' returns ', '', 'policy', 'returns', '   '],
      }),
    );

    expect(result.knowledge).toMatchObject({
      key: 'returns_policy',
      sourceType: 'MANUAL',
      language: 'fa',
      tags: ['returns', 'policy'],
      status: 'ACTIVE',
      isActive: true,
      createdById: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const uniquenessSql = rawText(prisma.$queryRaw, 0);
    const uniquenessValues = rawValues(prisma.$queryRaw, 0);

    expect(uniquenessSql).toContain('FROM "AiKnowledgeDocument"');
    expect(uniquenessSql).toContain('"deleted_at" IS NULL');
    expect(uniquenessValues).toContain('returns_policy');

    const insertSql = rawText(prisma.$executeRaw, 0);
    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertSql).toContain('INSERT INTO "AiKnowledgeDocument"');
    expect(insertValues).toContain('returns_policy');
    expect(insertValues).toContain('Returns policy');
    expect(insertValues).toContain('MANUAL');
    expect(insertValues).toContain('fa');
    expect(insertValues).toContain('Policy content');
    expect(insertValues).toContain('["returns","policy"]');
    expect(insertValues).toContain('ACTIVE');
    expect(insertValues).toContain(null);

    const eventSql = rawText(prisma.$executeRaw, 1);
    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventSql).toContain('INSERT INTO "Event"');
    expect(eventValues).toContain('ai.knowledge.created');
    expect(eventValues).toContain('سند دانش هوشمند توسط ادمین ایجاد شد.');
    expect(eventValues).toContain(null);

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"metadata":{}'),
    );

    expect(eventData).toBeDefined();
    expect(eventData).toContain('"key":"returns_policy"');
  });

  it('creates knowledge with explicit fields metadata and actor', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'shipping_faq',
          title: 'Shipping FAQ',
          sourceType: 'FAQ',
          language: 'en',
          content: 'Shipping content',
          tagsJson: ['shipping', 'faq'],
          metadata: {
            owner: 'support',
          },
          isActive: false,
          status: 'DRAFT',
          createdById: 'admin-2',
        }),
      ]);

    const result = await access.createKnowledge(
      createKnowledgeInput({
        key: ' Shipping FAQ ',
        title: 'Shipping FAQ',
        sourceType: 'FAQ',
        language: ' EN ',
        content: 'Shipping content',
        tags: [' shipping ', 'faq', 'shipping'],
        metadata: {
          owner: 'support',
        },
        isActive: false,
      }),
      'admin-2',
    );

    expect(result.knowledge).toMatchObject({
      key: 'shipping_faq',
      sourceType: 'FAQ',
      language: 'en',
      tags: ['shipping', 'faq'],
      metadata: {
        owner: 'support',
      },
      isActive: false,
      status: 'DRAFT',
      createdById: 'admin-2',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('shipping_faq');
    expect(insertValues).toContain('FAQ');
    expect(insertValues).toContain('en');
    expect(insertValues).toContain('["shipping","faq"]');
    expect(insertValues).toContain('DRAFT');
    expect(insertValues).toContain('admin-2');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.knowledge.created');
    expect(eventValues).toContain('admin-2');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"owner":"support"'),
    );

    expect(eventData).toBeDefined();
    expect(eventData).toContain('"key":"shipping_faq"');
  });

  it('rejects a duplicate knowledge key', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        count: 1,
      },
    ]);

    const operation = access.createKnowledge(createKnowledgeInput());

    await expect(operation).rejects.toEqual(
      new ConflictException('کلید سند دانش تکراری است.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();

    expect(rawValues(prisma.$queryRaw, 0)).toContain('returns_policy');
  });

  it('rejects an empty knowledge update', async () => {
    prisma.$queryRaw.mockResolvedValue([createKnowledgeRowFixture()]);

    const operation = access.updateKnowledge('knowledge-1', {}, 'admin-1');

    await expect(operation).rejects.toEqual(
      new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سند دانش ارسال نشده است.',
      ),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('updates the same normalized key without a uniqueness query', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'returns_policy',
        }),
      ])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'returns_policy',
        }),
      ]);

    const result = await access.updateKnowledge(
      'knowledge-1',
      {
        key: ' Returns Policy ',
      },
      'admin-1',
    );

    expect(result.knowledge.key).toBe('returns_policy');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).toContain(
      'FROM "AiKnowledgeDocument"',
    );

    expect(rawValues(prisma.$queryRaw, 0)).toContain('knowledge-1');

    const updateSql = rawText(prisma.$executeRaw, 0);
    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateSql).toContain('UPDATE "AiKnowledgeDocument"');
    expect(updateValues).toContain('returns_policy');
    expect(updateValues).toContain('knowledge-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.knowledge.updated');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(eventData).toContain('"changedFields":["key"]');
  });

  it('checks uniqueness with exceptId when the normalized key changes', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'returns_policy',
        }),
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'refund_policy',
        }),
      ]);

    const result = await access.updateKnowledge(
      'knowledge-1',
      {
        key: ' Refund Policy ',
      },
      'admin-1',
    );

    expect(result.knowledge.key).toBe('refund_policy');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);

    const uniquenessSql = rawText(prisma.$queryRaw, 1);
    const uniquenessValues = rawValues(prisma.$queryRaw, 1);

    expect(uniquenessSql).toContain('LOWER("key")');
    expect(uniquenessSql).toContain('"id" <>');
    expect(uniquenessSql).toContain('"deleted_at" IS NULL');
    expect(uniquenessValues).toContain('refund_policy');
    expect(uniquenessValues).toContain('knowledge-1');

    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateValues).toContain('refund_policy');
  });

  it('updates all mutable knowledge fields and preserves changedFields order', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createKnowledgeRowFixture()])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          key: 'returns_policy',
          title: 'Updated returns',
          sourceType: 'CMS',
          language: 'en',
          content: 'Updated content',
          tagsJson: ['updated', 'returns'],
          isActive: false,
          status: 'DRAFT',
        }),
      ]);

    const dto: KnowledgeUpdateInput = {
      title: 'Updated returns',
      sourceType: 'CMS',
      language: ' EN ',
      content: 'Updated content',
      tags: [' updated ', '', 'returns', 'updated'],
      isActive: false,
    };

    const result = await access.updateKnowledge('knowledge-1', dto, 'admin-1');

    expect(result.knowledge).toMatchObject({
      title: 'Updated returns',
      sourceType: 'CMS',
      language: 'en',
      content: 'Updated content',
      tags: ['updated', 'returns'],
      isActive: false,
      status: 'DRAFT',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const updateSql = rawText(prisma.$executeRaw, 0);
    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateSql).toContain('UPDATE "AiKnowledgeDocument"');
    expect(updateSql).toContain('"title" =');
    expect(updateSql).toContain('"sourceType" =');
    expect(updateSql).toContain('"language" =');
    expect(updateSql).toContain('"content" =');
    expect(updateSql).toContain('"tagsJson" =');
    expect(updateSql).toContain('"status" =');
    expect(updateSql).toContain('"updatedAt" =');
    expect(updateSql).toContain('"deleted_at" IS NULL');

    expect(updateValues).toContain('Updated returns');
    expect(updateValues).toContain('CMS');
    expect(updateValues).toContain('en');
    expect(updateValues).toContain('Updated content');
    expect(updateValues).toContain('["updated","returns"]');
    expect(updateValues).toContain('DRAFT');
    expect(updateValues).toContain('knowledge-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.knowledge.updated');
    expect(eventValues).toContain('admin-1');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(eventData).toContain(
      '"changedFields":["title","sourceType","language","content","tags","isActive"]',
    );
  });

  it('updates metadata without executing a knowledge document update', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createKnowledgeRowFixture()])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          metadata: {
            owner: 'catalog',
          },
        }),
      ]);

    const result = await access.updateKnowledge(
      'knowledge-1',
      {
        metadata: {
          owner: 'catalog',
        },
      },
      'admin-1',
    );

    expect(result.knowledge.metadata).toEqual({
      owner: 'catalog',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const firstSql = rawText(prisma.$executeRaw, 0);
    const secondSql = rawText(prisma.$executeRaw, 1);

    expect(firstSql).toContain('INSERT INTO "Event"');
    expect(secondSql).toContain('INSERT INTO "Event"');
    expect(firstSql).not.toContain('UPDATE "AiKnowledgeDocument"');
    expect(secondSql).not.toContain('UPDATE "AiKnowledgeDocument"');

    const metadataEventValues = rawValues(prisma.$executeRaw, 0);

    expect(metadataEventValues).toContain('ai.knowledge.metadata.updated');

    const metadataEventData = metadataEventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"owner":"catalog"'),
    );

    expect(metadataEventData).toContain('"documentId":"knowledge-1"');

    const updatedEventValues = rawValues(prisma.$executeRaw, 1);

    expect(updatedEventValues).toContain('ai.knowledge.updated');

    const updatedEventData = updatedEventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(updatedEventData).toContain('"changedFields":["metadata"]');
  });

  it('creates metadata and updated events when fields and metadata change', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createKnowledgeRowFixture()])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          title: 'Updated title',
          metadata: {
            reviewed: true,
          },
        }),
      ]);

    const result = await access.updateKnowledge(
      'knowledge-1',
      {
        title: 'Updated title',
        metadata: {
          reviewed: true,
        },
      },
      'admin-2',
    );

    expect(result.knowledge).toMatchObject({
      title: 'Updated title',
      metadata: {
        reviewed: true,
      },
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'UPDATE "AiKnowledgeDocument"',
    );

    const metadataEventValues = rawValues(prisma.$executeRaw, 1);

    expect(metadataEventValues).toContain('ai.knowledge.metadata.updated');
    expect(metadataEventValues).toContain('admin-2');

    const metadataData = metadataEventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"reviewed":true'),
    );

    expect(metadataData).toContain('"documentId":"knowledge-1"');

    const updatedEventValues = rawValues(prisma.$executeRaw, 2);

    expect(updatedEventValues).toContain('ai.knowledge.updated');

    const updatedData = updatedEventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(updatedData).toContain('"changedFields":["title","metadata"]');
  });

  it('soft-deletes knowledge and creates its event', async () => {
    prisma.$queryRaw.mockResolvedValue([createKnowledgeRowFixture()]);

    const result = await access.deleteKnowledge('knowledge-1', 'admin-1');

    expect(result).toEqual({
      success: true,
      message: 'سند دانش با موفقیت حذف شد.',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const deleteSql = rawText(prisma.$executeRaw, 0);
    const deleteValues = rawValues(prisma.$executeRaw, 0);

    expect(deleteSql).toContain('UPDATE "AiKnowledgeDocument"');
    expect(deleteSql).toContain('"deleted_at" =');
    expect(deleteSql).toContain('"updatedAt" =');
    expect(deleteSql).toContain('"deleted_at" IS NULL');
    expect(deleteValues).toContain('knowledge-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.knowledge.deleted');
    expect(eventValues).toContain('سند دانش هوشمند توسط ادمین حذف نرم شد.');
    expect(eventValues).toContain('admin-1');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.includes('"documentId":"knowledge-1"'),
    );

    expect(eventData).toBeDefined();
  });

  it('restores knowledge and returns its mapped result', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          deletedAt: new Date('2026-07-25T10:00:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([
        createKnowledgeRowFixture({
          deletedAt: null,
        }),
      ]);

    const result = await access.restoreKnowledge('knowledge-1', 'admin-1');

    expect(result.knowledge).toMatchObject({
      id: 'knowledge-1',
      deletedAt: null,
      deletedAtFa: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'k."deleted_at" IS NULL',
    );

    const restoreSql = rawText(prisma.$executeRaw, 0);
    const restoreValues = rawValues(prisma.$executeRaw, 0);

    expect(restoreSql).toContain('UPDATE "AiKnowledgeDocument"');
    expect(restoreSql).toContain('"deleted_at" = NULL');
    expect(restoreSql).toContain('"updatedAt" =');
    expect(restoreValues).toContain('knowledge-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.knowledge.restored');
    expect(eventValues).toContain('سند دانش هوشمند توسط ادمین بازگردانی شد.');
    expect(eventValues).toContain('admin-1');
  });

  it('propagates NotFoundException from update', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.updateKnowledge(
      'missing-knowledge',
      {
        title: 'Updated title',
      },
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new NotFoundException('سند دانش هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from delete', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.deleteKnowledge('missing-knowledge', 'admin-1');

    await expect(operation).rejects.toEqual(
      new NotFoundException('سند دانش هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from restore', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.restoreKnowledge('missing-knowledge', 'admin-1');

    await expect(operation).rejects.toEqual(
      new NotFoundException('سند دانش هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

type GuardrailRowFixture = {
  id: string;
  key: string;
  title: string;
  pattern: string | null;
  severity: string;
  action: string;
  message: string | null;
  isActive: boolean;
  ruleType: string;
  priority: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type GuardrailReadResult = {
  id: string;
  key: string;
  title: string;
  name: string;
  ruleType: string;
  pattern: string | null;
  severity: string;
  priority: number;
  action: string;
  message: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

type GuardrailQueryInput = {
  q?: string;
  severity?: string;
  action?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
};

type AdminAiDomain04AAccess = {
  findGuardrails(query: GuardrailQueryInput): Promise<{
    data: GuardrailReadResult[];
    meta: {
      total: number;
    };
  }>;

  findGuardrail(
    ruleId: string,
    includeDeleted?: boolean,
  ): Promise<GuardrailReadResult>;
};

const asDomain04AAccess = (service: AdminAiService): AdminAiDomain04AAccess =>
  service as unknown as AdminAiDomain04AAccess;

const createGuardrailRowFixture = (
  overrides: Partial<GuardrailRowFixture> = {},
): GuardrailRowFixture => ({
  id: 'guardrail-1',
  key: 'restricted_content',
  title: 'Restricted content',
  pattern: 'restricted',
  severity: 'HIGH',
  action: 'BLOCK',
  message: 'Restricted content is not allowed.',
  isActive: true,
  ruleType: 'restricted_content',
  priority: 85,
  createdById: 'admin-guardrail-1',
  createdAt: new Date('2026-07-25T08:00:00.000Z'),
  updatedAt: new Date('2026-07-25T09:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AdminAiService guardrail reads', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain04AAccess;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain04AAccess(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps guardrail rows and returns their total', async () => {
    prisma.$queryRaw.mockResolvedValue([createGuardrailRowFixture()]);

    const result = await access.findGuardrails({});
    const guardrail = result.data[0];

    expect(guardrail).toBeDefined();

    if (!guardrail) {
      throw new Error('Expected one mapped guardrail.');
    }

    expect(guardrail).toMatchObject({
      id: 'guardrail-1',
      key: 'restricted_content',
      title: 'Restricted content',
      name: 'Restricted content',
      ruleType: 'restricted_content',
      pattern: 'restricted',
      severity: 'HIGH',
      priority: 85,
      action: 'BLOCK',
      message: 'Restricted content is not allowed.',
      isActive: true,
      createdById: 'admin-guardrail-1',
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T09:00:00.000Z',
      deletedAt: null,
      deletedAtFa: null,
    });

    expect(typeof guardrail.createdAtFa).toBe('string');
    expect(typeof guardrail.updatedAtFa).toBe('string');

    expect(result.meta).toEqual({
      total: 1,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns an empty guardrail list and zero total', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(access.findGuardrails({})).resolves.toEqual({
      data: [],
      meta: {
        total: 0,
      },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('passes guardrail search and status filters to SQL', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findGuardrails({
      q: 'restricted',
      severity: 'HIGH',
      action: 'BLOCK',
      isActive: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    const sql = rawText(prisma.$queryRaw, 0);
    const values = rawValues(prisma.$queryRaw, 0);

    expect(values).toContain('%restricted%');
    expect(values).toContain('HIGH');
    expect(values).toContain('BLOCK');
    expect(values).toContain(false);

    expect(sql).toContain('g."ruleType" ILIKE');
    expect(sql).toContain('g."name" ILIKE');
    expect(sql).toContain('g."message" ILIKE');
    expect(sql).toContain('g."pattern" ILIKE');
    expect(sql).toContain('g."priority" >= 80');
    expect(sql).toContain('g."priority" >= 50');
    expect(sql).toContain('g."action" =');
    expect(sql).toContain('g."isActive" =');
    expect(sql).toContain('g."deleted_at" IS NULL');
    expect(sql).toContain('ORDER BY');
    expect(sql).toContain('g."priority" DESC');
    expect(sql).toContain('g."ruleType" ASC');
    expect(sql).toContain('LIMIT 500');
  });

  it('omits the deleted filter when includeDeleted is true', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findGuardrails({
      includeDeleted: true,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'g."deleted_at" IS NULL',
    );
  });

  it('maps one deleted guardrail when inclusion is allowed', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createGuardrailRowFixture({
        deletedAt: new Date('2026-07-25T10:00:00.000Z'),
      }),
    ]);

    const result = await access.findGuardrail('guardrail-1', true);

    expect(result).toMatchObject({
      id: 'guardrail-1',
      deletedAt: '2026-07-25T10:00:00.000Z',
    });

    expect(typeof result.deletedAtFa).toBe('string');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawValues(prisma.$queryRaw, 0)).toContain('guardrail-1');

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'g."deleted_at" IS NULL',
    );
  });

  it('excludes deleted rows when findGuardrail receives false', async () => {
    prisma.$queryRaw.mockResolvedValue([createGuardrailRowFixture()]);

    await access.findGuardrail('guardrail-1', false);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    expect(rawValues(prisma.$queryRaw, 0)).toContain('guardrail-1');

    expect(rawText(prisma.$queryRaw, 0)).toContain('g."deleted_at" IS NULL');
  });

  it('throws NotFoundException when a guardrail is absent', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.findGuardrail('missing-guardrail', true);

    await expect(operation).rejects.toEqual(
      new NotFoundException('قانون محافظ هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

type GuardrailCreateInput = {
  key: string;
  title?: string;
  pattern: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action?: 'WARN' | 'BLOCK';
  message?: string;
  isActive?: boolean;
};

type GuardrailUpdateInput = {
  key?: string;
  title?: string;
  pattern?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action?: 'WARN' | 'BLOCK';
  message?: string;
  isActive?: boolean;
};

type GuardrailMutationResult = {
  guardrail: GuardrailReadResult;
};

type GuardrailDeleteResult = {
  success: boolean;
  message: string;
};

type AdminAiDomain04BAccess = {
  createGuardrail(
    dto: GuardrailCreateInput,
    actorId?: string,
  ): Promise<GuardrailMutationResult>;

  updateGuardrail(
    ruleId: string,
    dto: GuardrailUpdateInput,
    actorId?: string,
  ): Promise<GuardrailMutationResult>;

  deleteGuardrail(
    ruleId: string,
    actorId?: string,
  ): Promise<GuardrailDeleteResult>;

  restoreGuardrail(
    ruleId: string,
    actorId?: string,
  ): Promise<GuardrailMutationResult>;
};

const asDomain04BAccess = (service: AdminAiService): AdminAiDomain04BAccess =>
  service as unknown as AdminAiDomain04BAccess;

const createGuardrailInput = (
  overrides: Partial<GuardrailCreateInput> = {},
): GuardrailCreateInput => ({
  key: 'Restricted Content',
  pattern: 'restricted',
  ...overrides,
});

describe('AdminAiService guardrail mutations', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain04BAccess;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);

    access = asDomain04BAccess(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a guardrail with normalized key and service defaults', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'restricted_content',
          title: 'restricted_content',
          pattern: 'restricted',
          severity: 'MEDIUM',
          priority: 50,
          action: 'WARN',
          message: null,
          isActive: true,
          ruleType: 'restricted_content',
          createdById: null,
        }),
      ]);

    const result = await access.createGuardrail(
      createGuardrailInput({
        key: ' Restricted Content ',
      }),
    );

    expect(result.guardrail).toMatchObject({
      key: 'restricted_content',
      title: 'restricted_content',
      name: 'restricted_content',
      ruleType: 'restricted_content',
      pattern: 'restricted',
      severity: 'MEDIUM',
      priority: 50,
      action: 'WARN',
      message: null,
      isActive: true,
      createdById: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const uniquenessSql = rawText(prisma.$queryRaw, 0);
    const uniquenessValues = rawValues(prisma.$queryRaw, 0);

    expect(uniquenessSql).toContain('FROM "AiGuardrailRule"');
    expect(uniquenessSql).toContain('LOWER("ruleType")');
    expect(uniquenessSql).toContain('"deleted_at" IS NULL');
    expect(uniquenessValues).toContain('restricted_content');

    const insertSql = rawText(prisma.$executeRaw, 0);
    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertSql).toContain('INSERT INTO "AiGuardrailRule"');
    expect(insertValues).toContain('restricted_content');
    expect(insertValues).toContain('restricted');
    expect(insertValues).toContain('WARN');
    expect(insertValues).toContain(null);
    expect(insertValues).toContain(true);
    expect(insertValues).toContain(50);

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.created');
    expect(eventValues).toContain('قانون محافظ هوشمند توسط ادمین ایجاد شد.');
    expect(eventValues).toContain(null);

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.includes('"key":"restricted_content"'),
    );

    expect(eventData).toBeDefined();
  });

  it('creates a guardrail with explicit fields severity and actor', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'payment_risk',
          title: 'Payment risk',
          pattern: 'payment\\s+risk',
          severity: 'CRITICAL',
          priority: 100,
          action: 'BLOCK',
          message: 'Payment risk detected.',
          isActive: false,
          ruleType: 'payment_risk',
          createdById: 'admin-2',
        }),
      ]);

    const result = await access.createGuardrail(
      createGuardrailInput({
        key: ' Payment Risk ',
        title: 'Payment risk',
        pattern: 'payment\\s+risk',
        severity: 'CRITICAL',
        action: 'BLOCK',
        message: 'Payment risk detected.',
        isActive: false,
      }),
      'admin-2',
    );

    expect(result.guardrail).toMatchObject({
      key: 'payment_risk',
      title: 'Payment risk',
      ruleType: 'payment_risk',
      pattern: 'payment\\s+risk',
      severity: 'CRITICAL',
      priority: 100,
      action: 'BLOCK',
      message: 'Payment risk detected.',
      isActive: false,
      createdById: 'admin-2',
    });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('payment_risk');
    expect(insertValues).toContain('Payment risk');
    expect(insertValues).toContain('payment\\s+risk');
    expect(insertValues).toContain('BLOCK');
    expect(insertValues).toContain('Payment risk detected.');
    expect(insertValues).toContain(false);
    expect(insertValues).toContain(100);
    expect(insertValues).toContain('admin-2');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.created');
    expect(eventValues).toContain('admin-2');
  });

  it('rejects an invalid create pattern before uniqueness and writes', async () => {
    const operation = access.createGuardrail(
      createGuardrailInput({
        pattern: '[',
      }),
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new BadRequestException('الگوی قانون محافظ معتبر نیست.'),
    );

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects a duplicate guardrail key', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        count: 1,
      },
    ]);

    const operation = access.createGuardrail(createGuardrailInput(), 'admin-1');

    await expect(operation).rejects.toEqual(
      new ConflictException('کلید قانون محافظ تکراری است.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();

    expect(rawValues(prisma.$queryRaw, 0)).toContain('restricted_content');
  });

  it('rejects an empty guardrail update', async () => {
    prisma.$queryRaw.mockResolvedValue([createGuardrailRowFixture()]);

    const operation = access.updateGuardrail('guardrail-1', {}, 'admin-1');

    await expect(operation).rejects.toEqual(
      new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قانون محافظ ارسال نشده است.',
      ),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('updates the same normalized key without a uniqueness query', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'restricted_content',
        }),
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'restricted_content',
        }),
      ]);

    const result = await access.updateGuardrail(
      'guardrail-1',
      {
        key: ' Restricted Content ',
      },
      'admin-1',
    );

    expect(result.guardrail.key).toBe('restricted_content');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const updateSql = rawText(prisma.$executeRaw, 0);
    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateSql).toContain('UPDATE "AiGuardrailRule"');
    expect(updateSql).toContain('"ruleType" =');
    expect(updateValues).toContain('restricted_content');
    expect(updateValues).toContain('guardrail-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.updated');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(eventData).toContain('"changedFields":["key"]');
  });

  it('checks uniqueness with exceptId when the normalized key changes', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'restricted_content',
        }),
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'payment_risk',
          ruleType: 'payment_risk',
        }),
      ]);

    const result = await access.updateGuardrail(
      'guardrail-1',
      {
        key: ' Payment Risk ',
      },
      'admin-1',
    );

    expect(result.guardrail.key).toBe('payment_risk');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);

    const uniquenessSql = rawText(prisma.$queryRaw, 1);
    const uniquenessValues = rawValues(prisma.$queryRaw, 1);

    expect(uniquenessSql).toContain('LOWER("ruleType")');
    expect(uniquenessSql).toContain('"id" <>');
    expect(uniquenessSql).toContain('"deleted_at" IS NULL');
    expect(uniquenessValues).toContain('payment_risk');
    expect(uniquenessValues).toContain('guardrail-1');

    expect(rawValues(prisma.$executeRaw, 0)).toContain('payment_risk');
  });

  it('rejects an invalid update pattern before update and event writes', async () => {
    prisma.$queryRaw.mockResolvedValue([createGuardrailRowFixture()]);

    const operation = access.updateGuardrail(
      'guardrail-1',
      {
        pattern: '[',
      },
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new BadRequestException('الگوی قانون محافظ معتبر نیست.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('updates all mutable guardrail fields and preserves changedFields order', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'restricted_content',
        }),
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          key: 'payment_risk',
          title: 'Updated payment risk',
          pattern: 'payment\\s+risk',
          severity: 'LOW',
          priority: 30,
          action: 'WARN',
          message: 'Review this payment.',
          isActive: false,
          ruleType: 'payment_risk',
        }),
      ]);

    const dto: GuardrailUpdateInput = {
      key: ' Payment Risk ',
      title: 'Updated payment risk',
      pattern: 'payment\\s+risk',
      severity: 'LOW',
      action: 'WARN',
      message: 'Review this payment.',
      isActive: false,
    };

    const result = await access.updateGuardrail('guardrail-1', dto, 'admin-1');

    expect(result.guardrail).toMatchObject({
      key: 'payment_risk',
      title: 'Updated payment risk',
      name: 'Updated payment risk',
      ruleType: 'payment_risk',
      pattern: 'payment\\s+risk',
      severity: 'LOW',
      priority: 30,
      action: 'WARN',
      message: 'Review this payment.',
      isActive: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const updateSql = rawText(prisma.$executeRaw, 0);
    const updateValues = rawValues(prisma.$executeRaw, 0);

    expect(updateSql).toContain('UPDATE "AiGuardrailRule"');
    expect(updateSql).toContain('"ruleType" =');
    expect(updateSql).toContain('"name" =');
    expect(updateSql).toContain('"pattern" =');
    expect(updateSql).toContain('"priority" =');
    expect(updateSql).toContain('"action" =');
    expect(updateSql).toContain('"message" =');
    expect(updateSql).toContain('"isActive" =');
    expect(updateSql).toContain('"updatedAt" =');
    expect(updateSql).toContain('"deleted_at" IS NULL');

    expect(updateValues).toContain('payment_risk');
    expect(updateValues).toContain('Updated payment risk');
    expect(updateValues).toContain('payment\\s+risk');
    expect(updateValues).toContain(30);
    expect(updateValues).toContain('WARN');
    expect(updateValues).toContain('Review this payment.');
    expect(updateValues).toContain(false);
    expect(updateValues).toContain('guardrail-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.updated');
    expect(eventValues).toContain(
      'قانون محافظ هوشمند توسط ادمین به‌روزرسانی شد.',
    );
    expect(eventValues).toContain('admin-1');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"changedFields"'),
    );

    expect(eventData).toContain(
      '"changedFields":["key","title","pattern","severity","action","message","isActive"]',
    );
  });

  it('soft-deletes a guardrail and creates its event', async () => {
    prisma.$queryRaw.mockResolvedValue([createGuardrailRowFixture()]);

    const result = await access.deleteGuardrail('guardrail-1', 'admin-1');

    expect(result).toEqual({
      success: true,
      message: 'قانون محافظ با موفقیت حذف شد.',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).toContain('g."deleted_at" IS NULL');

    const deleteSql = rawText(prisma.$executeRaw, 0);
    const deleteValues = rawValues(prisma.$executeRaw, 0);

    expect(deleteSql).toContain('UPDATE "AiGuardrailRule"');
    expect(deleteSql).toContain('"deleted_at" =');
    expect(deleteSql).toContain('"updatedAt" =');
    expect(deleteSql).toContain('"deleted_at" IS NULL');
    expect(deleteValues).toContain('guardrail-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.deleted');
    expect(eventValues).toContain('قانون محافظ هوشمند توسط ادمین حذف نرم شد.');
    expect(eventValues).toContain('admin-1');

    const eventData = eventValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"ruleId":"guardrail-1"'),
    );

    expect(eventData).toBeDefined();
  });

  it('restores a guardrail and returns its mapped result', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          deletedAt: new Date('2026-07-25T10:00:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([
        createGuardrailRowFixture({
          deletedAt: null,
        }),
      ]);

    const result = await access.restoreGuardrail('guardrail-1', 'admin-1');

    expect(result.guardrail).toMatchObject({
      id: 'guardrail-1',
      deletedAt: null,
      deletedAtFa: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'g."deleted_at" IS NULL',
    );

    const restoreSql = rawText(prisma.$executeRaw, 0);
    const restoreValues = rawValues(prisma.$executeRaw, 0);

    expect(restoreSql).toContain('UPDATE "AiGuardrailRule"');
    expect(restoreSql).toContain('"deleted_at" = NULL');
    expect(restoreSql).toContain('"updatedAt" =');
    expect(restoreValues).toContain('guardrail-1');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.guardrail.restored');
    expect(eventValues).toContain(
      'قانون محافظ هوشمند توسط ادمین بازگردانی شد.',
    );
    expect(eventValues).toContain('admin-1');
  });

  it('propagates NotFoundException from update', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.updateGuardrail(
      'missing-guardrail',
      {
        title: 'Updated title',
      },
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new NotFoundException('قانون محافظ هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from delete', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.deleteGuardrail('missing-guardrail', 'admin-1');

    await expect(operation).rejects.toEqual(
      new NotFoundException('قانون محافظ هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from restore', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.restoreGuardrail('missing-guardrail', 'admin-1');

    await expect(operation).rejects.toEqual(
      new NotFoundException('قانون محافظ هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

type RecommendationRowFixture = {
  id: string;
  targetType: string;
  targetId: string | null;
  title: string;
  message: string;
  severity: string;
  status: string;
  metadata: unknown;
  createdByRunId: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type RecommendationReadResult = {
  id: string;
  targetType: string;
  targetId: string | null;
  title: string;
  message: string;
  severity: string;
  status: string;
  metadata: unknown;
  createdByRunId: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolvedAtFa: string | null;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

type RecommendationQueryInput = {
  q?: string;
  entityId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendationStatus?: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  includeDeleted?: boolean;
};

type AdminAiDomain05AAccess = {
  findRecommendations(query: RecommendationQueryInput): Promise<{
    data: RecommendationReadResult[];
    meta: { total: number };
  }>;

  findRecommendation(
    recommendationId: string,
    includeDeleted?: boolean,
  ): Promise<RecommendationReadResult>;
};

const asDomain05AAccess = (service: AdminAiService): AdminAiDomain05AAccess =>
  service as unknown as AdminAiDomain05AAccess;

const createRecommendationRowFixture = (
  overrides: Partial<RecommendationRowFixture> = {},
): RecommendationRowFixture => ({
  id: 'recommendation-1',
  targetType: 'PRODUCT',
  targetId: 'product-1',
  title: 'Improve product title',
  message: 'Add a more descriptive product title.',
  severity: 'HIGH',
  status: 'OPEN',
  metadata: {
    title: 'Improve product title',
    message: 'Add a more descriptive product title.',
    severity: 'HIGH',
    adminStatus: 'OPEN',
  },
  createdByRunId: 'run-1',
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date('2026-07-25T08:00:00.000Z'),
  updatedAt: new Date('2026-07-25T09:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AdminAiService recommendation reads', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain05AAccess;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AdminAiService(prisma as unknown as PrismaService);
    access = asDomain05AAccess(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps recommendation rows and returns their total', async () => {
    prisma.$queryRaw.mockResolvedValue([createRecommendationRowFixture()]);

    const result = await access.findRecommendations({});
    const recommendation = result.data[0];

    expect(recommendation).toBeDefined();

    if (!recommendation) {
      throw new Error('Expected one mapped recommendation.');
    }

    expect(recommendation).toMatchObject({
      id: 'recommendation-1',
      targetType: 'PRODUCT',
      targetId: 'product-1',
      title: 'Improve product title',
      message: 'Add a more descriptive product title.',
      severity: 'HIGH',
      status: 'OPEN',
      createdByRunId: 'run-1',
      resolvedById: null,
      resolvedAt: null,
      resolvedAtFa: null,
      createdAt: '2026-07-25T08:00:00.000Z',
      updatedAt: '2026-07-25T09:00:00.000Z',
      deletedAt: null,
      deletedAtFa: null,
    });

    expect(typeof recommendation.createdAtFa).toBe('string');
    expect(typeof recommendation.updatedAtFa).toBe('string');
    expect(result.meta).toEqual({ total: 1 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('returns an empty recommendation list and zero total', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(access.findRecommendations({})).resolves.toEqual({
      data: [],
      meta: { total: 0 },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('passes recommendation filters ordering and limit to SQL', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findRecommendations({
      q: 'title',
      entityId: 'product-1',
      severity: 'HIGH',
      recommendationStatus: 'RESOLVED',
    });

    const sql = rawText(prisma.$queryRaw, 0);
    const values = rawValues(prisma.$queryRaw, 0);

    expect(values).toContain('%title%');
    expect(values).toContain('product-1');
    expect(values).toContain('HIGH');
    expect(values).toContain('RESOLVED');

    expect(sql).toContain('rec."type" ILIKE');
    expect(sql).toContain('rec."reason" ILIKE');
    expect(sql).toContain('rec."metadata"::text ILIKE');
    expect(sql).toContain('rec."id" =');
    expect(sql).toContain('rec."productId" =');
    expect(sql).toContain('rec."userId" =');
    expect(sql).toContain("metadata\" ->> 'severity'");
    expect(sql).toContain("metadata\" ->> 'adminStatus'");
    expect(sql).toContain('rec."deleted_at" IS NULL');
    expect(sql).toContain('rec."score" DESC');
    expect(sql).toContain('rec."createdAt" DESC');
    expect(sql).toContain('LIMIT 500');
  });

  it('omits the deleted filter when includeDeleted is true', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await access.findRecommendations({
      includeDeleted: true,
    });

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'rec."deleted_at" IS NULL',
    );
  });

  it('uses metadata resolution fields when row fields are null', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        metadata: {
          resolvedById: 'admin-2',
          resolvedAt: '2026-07-25T10:00:00.000Z',
        },
        resolvedById: null,
        resolvedAt: null,
      }),
    ]);

    const result = await access.findRecommendations({});
    const recommendation = result.data[0];

    expect(recommendation).toBeDefined();

    if (!recommendation) {
      throw new Error('Expected one resolved recommendation.');
    }

    expect(recommendation).toMatchObject({
      resolvedById: 'admin-2',
      resolvedAt: '2026-07-25T10:00:00.000Z',
    });

    expect(typeof recommendation.resolvedAtFa).toBe('string');
  });

  it('prefers row resolution fields over metadata values', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        metadata: {
          resolvedById: 'metadata-admin',
          resolvedAt: '2026-07-25T10:00:00.000Z',
        },
        resolvedById: 'row-admin',
        resolvedAt: new Date('2026-07-25T11:00:00.000Z'),
      }),
    ]);

    const result = await access.findRecommendations({});

    expect(result.data[0]).toMatchObject({
      resolvedById: 'row-admin',
      resolvedAt: '2026-07-25T11:00:00.000Z',
    });
  });

  it('ignores invalid metadata resolvedAt values', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        metadata: {
          resolvedById: 17,
          resolvedAt: 'not-a-date',
        },
        resolvedById: null,
        resolvedAt: null,
      }),
    ]);

    const result = await access.findRecommendations({});

    expect(result.data[0]).toMatchObject({
      resolvedById: null,
      resolvedAt: null,
      resolvedAtFa: null,
    });
  });

  it('maps a deleted recommendation when inclusion is allowed', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        deletedAt: new Date('2026-07-25T12:00:00.000Z'),
      }),
    ]);

    const result = await access.findRecommendation('recommendation-1', true);

    expect(result).toMatchObject({
      id: 'recommendation-1',
      deletedAt: '2026-07-25T12:00:00.000Z',
    });
    expect(typeof result.deletedAtFa).toBe('string');

    expect(rawValues(prisma.$queryRaw, 0)).toContain('recommendation-1');

    expect(rawText(prisma.$queryRaw, 0)).not.toContain(
      'rec."deleted_at" IS NULL',
    );
  });

  it('excludes deleted rows when findRecommendation receives false', async () => {
    prisma.$queryRaw.mockResolvedValue([createRecommendationRowFixture()]);

    await access.findRecommendation('recommendation-1', false);

    expect(rawValues(prisma.$queryRaw, 0)).toContain('recommendation-1');

    expect(rawText(prisma.$queryRaw, 0)).toContain('rec."deleted_at" IS NULL');
  });

  it('throws NotFoundException when a recommendation is absent', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.findRecommendation('missing-recommendation', true);

    await expect(operation).rejects.toEqual(
      new NotFoundException('پیشنهاد هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

type RecommendationCreateInput = {
  targetType:
    | 'STORE'
    | 'ORDER'
    | 'PRODUCT'
    | 'CUSTOMER'
    | 'SEO'
    | 'SUPPORT'
    | 'SEARCH'
    | 'PAYMENT'
    | 'INVENTORY';
  targetId?: string;
  title: string;
  message: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, unknown>;
};

type RecommendationStatusInput = {
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  reason?: string;
};

type RecommendationMutationResult = {
  recommendation: RecommendationReadResult;
};

type RecommendationDeleteResult = {
  success: boolean;
  message: string;
};

type AdminAiDomain05BAccess = {
  createRecommendation(
    dto: RecommendationCreateInput,
    actorId?: string,
  ): Promise<RecommendationMutationResult>;

  updateRecommendationStatus(
    recommendationId: string,
    dto: RecommendationStatusInput,
    actorId?: string,
  ): Promise<RecommendationMutationResult>;

  deleteRecommendation(
    recommendationId: string,
    actorId?: string,
  ): Promise<RecommendationDeleteResult>;
};

const asDomain05BAccess = (service: AdminAiService): AdminAiDomain05BAccess =>
  service as unknown as AdminAiDomain05BAccess;

const createRecommendationInput = (
  overrides: Partial<RecommendationCreateInput> = {},
): RecommendationCreateInput => ({
  targetType: 'PRODUCT',
  targetId: 'product-1',
  title: 'Improve product content',
  message: 'Complete the missing product information.',
  ...overrides,
});

describe('AdminAiService recommendation mutations', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;
  let access: AdminAiDomain05BAccess;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AdminAiService(prisma as unknown as PrismaService);
    access = asDomain05BAccess(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a PRODUCT recommendation with defaults and anonymous actor', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        targetType: 'PRODUCT',
        targetId: 'product-1',
        title: 'Improve product content',
        message: 'Complete the missing product information.',
        severity: 'MEDIUM',
        status: 'OPEN',
      }),
    ]);

    const result = await access.createRecommendation(
      createRecommendationInput(),
    );

    expect(result.recommendation).toMatchObject({
      targetType: 'PRODUCT',
      targetId: 'product-1',
      severity: 'MEDIUM',
      status: 'OPEN',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'INSERT INTO "AiRecommendation"',
    );

    expect(insertValues).toContain('PRODUCT');
    expect(insertValues).toContain('product-1');

    expect(insertValues.find((value) => String(value) === '0.6')).toBeDefined();

    const metadata = insertValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"adminStatus":"OPEN"'),
    );

    expect(metadata).toContain('"severity":"MEDIUM"');
    expect(metadata).toContain('"actorId":null');
    expect(metadata).toContain('"targetType":"PRODUCT"');
    expect(metadata).toContain('"targetId":"product-1"');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.recommendation.created');
    expect(eventValues).toContain(null);
  });

  it('creates a CUSTOMER recommendation using userId and explicit metadata', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        targetType: 'CUSTOMER',
        targetId: 'customer-1',
        title: 'Customer follow-up',
        message: 'Contact this customer.',
        severity: 'CRITICAL',
      }),
    ]);

    const result = await access.createRecommendation(
      createRecommendationInput({
        targetType: 'CUSTOMER',
        targetId: 'customer-1',
        title: 'Customer follow-up',
        message: 'Contact this customer.',
        severity: 'CRITICAL',
        metadata: {
          source: 'manual',
        },
      }),
      'admin-2',
    );

    expect(result.recommendation).toMatchObject({
      targetType: 'CUSTOMER',
      targetId: 'customer-1',
      severity: 'CRITICAL',
    });

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('CUSTOMER');
    expect(insertValues).toContain(null);
    expect(insertValues).toContain('customer-1');

    expect(insertValues.find((value) => String(value) === '1')).toBeDefined();

    const metadata = insertValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"source":"manual"'),
    );

    expect(metadata).toContain('"actorId":"admin-2"');
    expect(metadata).toContain('"targetType":"CUSTOMER"');
    expect(metadata).toContain('"targetId":"customer-1"');
  });

  it('creates a STORE recommendation without productId or userId', async () => {
    prisma.$queryRaw.mockResolvedValue([
      createRecommendationRowFixture({
        targetType: 'STORE',
        targetId: null,
        title: 'Store health review',
        message: 'Review store health.',
        severity: 'LOW',
      }),
    ]);

    const result = await access.createRecommendation(
      createRecommendationInput({
        targetType: 'STORE',
        targetId: undefined,
        title: 'Store health review',
        message: 'Review store health.',
        severity: 'LOW',
      }),
      'admin-1',
    );

    expect(result.recommendation).toMatchObject({
      targetType: 'STORE',
      targetId: null,
      severity: 'LOW',
    });

    const insertValues = rawValues(prisma.$executeRaw, 0);

    expect(insertValues).toContain('STORE');

    const nullValues = insertValues.filter((value) => value === null);

    expect(nullValues).toHaveLength(2);

    expect(
      insertValues.find((value) => String(value) === '0.35'),
    ).toBeDefined();

    const metadata = insertValues.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"targetType":"STORE"'),
    );

    expect(metadata).toContain('"targetId":null');
    expect(metadata).toContain('"severity":"LOW"');
    expect(metadata).toContain('"actorId":"admin-1"');
  });

  it('reopens a recommendation and clears resolution fields', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        createRecommendationRowFixture({
          status: 'RESOLVED',
        }),
      ])
      .mockResolvedValueOnce([
        createRecommendationRowFixture({
          status: 'OPEN',
          resolvedById: null,
          resolvedAt: null,
        }),
      ]);

    const result = await access.updateRecommendationStatus(
      'recommendation-1',
      {
        status: 'OPEN',
        reason: 'Needs another review.',
      },
      'admin-1',
    );

    expect(result.recommendation).toMatchObject({
      status: 'OPEN',
      resolvedById: null,
      resolvedAt: null,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).toContain('rec."deleted_at" IS NULL');

    const patch = rawValues(prisma.$executeRaw, 0).find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"adminStatus":"OPEN"'),
    );

    expect(patch).toContain('"statusReason":"Needs another review."');
    expect(patch).toContain('"resolvedById":null');
    expect(patch).toContain('"resolvedAt":null');

    expect(rawValues(prisma.$executeRaw, 1)).toContain(
      'ai.recommendation.status.updated',
    );
  });

  it('resolves a recommendation with actor reason and resolution timestamp', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createRecommendationRowFixture()])
      .mockResolvedValueOnce([
        createRecommendationRowFixture({
          status: 'RESOLVED',
          resolvedById: 'admin-2',
          resolvedAt: new Date('2026-07-26T18:00:00.000Z'),
        }),
      ]);

    const result = await access.updateRecommendationStatus(
      'recommendation-1',
      {
        status: 'RESOLVED',
        reason: 'Completed by administrator.',
      },
      'admin-2',
    );

    expect(result.recommendation).toMatchObject({
      status: 'RESOLVED',
      resolvedById: 'admin-2',
      resolvedAt: '2026-07-26T18:00:00.000Z',
    });

    const patch = rawValues(prisma.$executeRaw, 0).find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"adminStatus":"RESOLVED"'),
    );

    expect(patch).toContain('"statusReason":"Completed by administrator."');
    expect(patch).toContain('"resolvedById":"admin-2"');
    expect(patch).toContain('"resolvedAt":"');

    const eventData = rawValues(prisma.$executeRaw, 1).find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"status":"RESOLVED"'),
    );

    expect(eventData).toContain('"reason":"Completed by administrator."');
  });

  it('dismisses a recommendation without an actor or reason', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createRecommendationRowFixture()])
      .mockResolvedValueOnce([
        createRecommendationRowFixture({
          status: 'DISMISSED',
          resolvedById: null,
        }),
      ]);

    const result = await access.updateRecommendationStatus('recommendation-1', {
      status: 'DISMISSED',
    });

    expect(result.recommendation.status).toBe('DISMISSED');

    const patch = rawValues(prisma.$executeRaw, 0).find(
      (value): value is string =>
        typeof value === 'string' &&
        value.includes('"adminStatus":"DISMISSED"'),
    );

    expect(patch).toContain('"statusReason":null');
    expect(patch).toContain('"resolvedById":null');
    expect(patch).toContain('"resolvedAt":"');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.recommendation.status.updated');
    expect(eventValues).toContain(null);
  });

  it('soft-deletes a recommendation and creates its event', async () => {
    prisma.$queryRaw.mockResolvedValue([createRecommendationRowFixture()]);

    const result = await access.deleteRecommendation(
      'recommendation-1',
      'admin-1',
    );

    expect(result).toEqual({
      success: true,
      message: 'پیشنهاد هوشمند با موفقیت حذف شد.',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

    expect(rawText(prisma.$queryRaw, 0)).toContain('rec."deleted_at" IS NULL');

    expect(rawText(prisma.$executeRaw, 0)).toContain(
      'UPDATE "AiRecommendation"',
    );

    expect(rawText(prisma.$executeRaw, 0)).toContain('"deleted_at" =');

    const eventValues = rawValues(prisma.$executeRaw, 1);

    expect(eventValues).toContain('ai.recommendation.deleted');
    expect(eventValues).toContain('admin-1');
  });

  it('propagates NotFoundException from status update', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.updateRecommendationStatus(
      'missing-recommendation',
      {
        status: 'RESOLVED',
      },
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new NotFoundException('پیشنهاد هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from delete', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    const operation = access.deleteRecommendation(
      'missing-recommendation',
      'admin-1',
    );

    await expect(operation).rejects.toEqual(
      new NotFoundException('پیشنهاد هوشمند یافت نشد.'),
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

const createFinalAdminAiNoteRow = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    category: string;
    userId: string | null;
    data: unknown;
    timestamp: Date;
    createdAt: Date;
  }> = {},
) => ({
  id: 'final-note-event-1',
  name: 'ai.note.created',
  description: 'یادداشت مدیریتی برای هوشمندی ثبت شد.',
  category: 'ai',
  userId: 'final-admin-1',
  data: {
    entityKey: 'final-product-1',
    note: 'Review final product content.',
    isImportant: true,
    visibility: 'admin',
  },
  timestamp: new Date('2026-07-26T19:30:00.000Z'),
  createdAt: new Date('2026-07-26T19:30:00.000Z'),
  ...overrides,
});

const finalTemplateExportResult: Awaited<
  ReturnType<AdminAiService['findTemplates']>
> = {
  data: [],
  meta: {
    total: 0,
  },
};

const finalKnowledgeExportResult: Awaited<
  ReturnType<AdminAiService['findKnowledge']>
> = {
  data: [],
  meta: {
    total: 0,
  },
};

const finalGuardrailExportResult: Awaited<
  ReturnType<AdminAiService['findGuardrails']>
> = {
  data: [],
  meta: {
    total: 0,
  },
};

const finalRecommendationExportResult: Awaited<
  ReturnType<AdminAiService['findRecommendations']>
> = {
  data: [],
  meta: {
    total: 0,
  },
};

const finalRunExportResult: Awaited<ReturnType<AdminAiService['findRuns']>> = {
  data: [],
  meta: {
    page: 1,
    limit: 200,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  },
};

describe('AdminAiService final notes and exports', () => {
  let prisma: PrismaMock;
  let service: AdminAiService;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new AdminAiService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates notes with default and explicit fields', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    const defaultResult = await service.createNote('final-product-1', {
      note: 'Review final product content.',
    });

    expect(defaultResult).toMatchObject({
      success: true,
      message: 'یادداشت هوشمندی با موفقیت ثبت شد.',
    });

    expect(defaultResult.noteId).not.toBe('');

    const defaultSql = rawText(prisma.$executeRaw, 0);

    const defaultValues = rawValues(prisma.$executeRaw, 0);

    expect(defaultSql).toContain('INSERT INTO "Event"');

    expect(defaultValues).toContain('ai.note.created');

    expect(defaultValues).toContain('یادداشت مدیریتی برای هوشمندی ثبت شد.');

    expect(defaultValues).toContain(null);

    const defaultData = defaultValues.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.includes('"entityKey":"final-product-1"'),
    );

    expect(defaultData).toContain('"note":"Review final product content."');

    expect(defaultData).toContain('"isImportant":false');

    expect(defaultData).toContain('"visibility":"admin"');

    const explicitResult = await service.createNote(
      'final-order-1',
      {
        note: 'Escalate final order.',
        isImportant: true,
        visibility: 'super-admin',
      },
      'final-admin-2',
    );

    expect(explicitResult.success).toBe(true);
    expect(explicitResult.noteId).not.toBe('');

    const explicitValues = rawValues(prisma.$executeRaw, 1);

    expect(explicitValues).toContain('final-admin-2');

    const explicitData = explicitValues.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.includes('"entityKey":"final-order-1"'),
    );

    expect(explicitData).toContain('"note":"Escalate final order."');

    expect(explicitData).toContain('"isImportant":true');

    expect(explicitData).toContain('"visibility":"super-admin"');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('gets scoped and global notes with mapping and limit normalization', async () => {
    const row = createFinalAdminAiNoteRow();

    prisma.$queryRaw
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);

    const scoped = await service.getNotes('final-product-1', 999);

    expect(scoped.meta).toEqual({
      entityKey: 'final-product-1',
      total: 1,
    });

    expect(scoped.data[0]).toMatchObject({
      id: 'final-note-event-1',
      note: 'Review final product content.',
      isImportant: true,
      visibility: 'admin',
      actorId: 'final-admin-1',
      createdAt: '2026-07-26T19:30:00.000Z',
    });

    expect(typeof scoped.data[0]?.createdAtFa).toBe('string');

    const scopedSql = rawText(prisma.$queryRaw, 0);

    const scopedValues = rawValues(prisma.$queryRaw, 0);

    expect(scopedSql).toContain('FROM "Event"');

    expect(scopedSql).toContain('"deleted_at" IS NULL');

    expect(scopedSql).toContain('"name" = \'ai.note.created\'');

    expect(scopedSql).toContain('"data" #>> \'{entityKey}\' =');

    expect(scopedSql).toContain('"timestamp" DESC');

    expect(scopedSql).toContain('"createdAt" DESC');

    expect(scopedValues).toContain('final-product-1');

    expect(scopedValues).toContain(200);

    await service.getNotes('final-product-1', 0);

    expect(rawValues(prisma.$queryRaw, 1)).toContain(1);

    const global = await service.getAllNotes(40);

    expect(global.meta).toEqual({
      total: 1,
    });

    expect(global.data[0]).toMatchObject({
      id: 'final-note-event-1',
      note: 'Review final product content.',
      isImportant: true,
      visibility: 'admin',
      actorId: 'final-admin-1',
    });

    const globalSql = rawText(prisma.$queryRaw, 2);

    const globalValues = rawValues(prisma.$queryRaw, 2);

    expect(globalSql).not.toContain('"data" #>> \'{entityKey}\' =');

    expect(globalValues).not.toContain('final-product-1');

    expect(globalValues).toContain(40);

    await expect(service.getAllNotes()).resolves.toEqual({
      data: [],
      meta: {
        total: 0,
      },
    });

    expect(rawValues(prisma.$queryRaw, 3)).toContain(50);
  });

  it('routes all explicit export entities using their exact method contracts', async () => {
    const templateSpy = jest
      .spyOn(service, 'findTemplates')
      .mockResolvedValue(finalTemplateExportResult);

    const knowledgeSpy = jest
      .spyOn(service, 'findKnowledge')
      .mockResolvedValue(finalKnowledgeExportResult);

    const guardrailSpy = jest
      .spyOn(service, 'findGuardrails')
      .mockResolvedValue(finalGuardrailExportResult);

    const recommendationSpy = jest
      .spyOn(service, 'findRecommendations')
      .mockResolvedValue(finalRecommendationExportResult);

    const runSpy = jest
      .spyOn(service, 'findRuns')
      .mockResolvedValue(finalRunExportResult);

    await expect(
      service.findForExport({
        entity: 'templates',
        q: 'seo',
        taskType: 'SEO_REVIEW',
      }),
    ).resolves.toBe(finalTemplateExportResult.data);

    expect(templateSpy).toHaveBeenCalledWith({
      q: 'seo',
      taskType: 'SEO_REVIEW',
    });

    await expect(
      service.findForExport({
        entity: 'knowledge',
        q: 'catalog',
        taskType: 'SEO_REVIEW',
      }),
    ).resolves.toBe(finalKnowledgeExportResult.data);

    expect(knowledgeSpy).toHaveBeenCalledWith({
      q: 'catalog',
    });

    await expect(
      service.findForExport({
        entity: 'guardrails',
        q: 'blocked',
      }),
    ).resolves.toBe(finalGuardrailExportResult.data);

    expect(guardrailSpy).toHaveBeenCalledWith({
      q: 'blocked',
    });

    await expect(
      service.findForExport({
        entity: 'recommendations',
        q: 'product',
      }),
    ).resolves.toBe(finalRecommendationExportResult.data);

    expect(recommendationSpy).toHaveBeenCalledWith({
      q: 'product',
    });

    await expect(
      service.findForExport({
        entity: 'runs',
        q: 'failed',
        taskType: 'SUPPORT_SUMMARY',
      }),
    ).resolves.toBe(finalRunExportResult.data);

    expect(runSpy).toHaveBeenCalledWith({
      page: 1,
      limit: 200,
      q: 'failed',
      taskType: 'SUPPORT_SUMMARY',
    });

    expect(templateSpy).toHaveBeenCalledTimes(1);
    expect(knowledgeSpy).toHaveBeenCalledTimes(1);
    expect(guardrailSpy).toHaveBeenCalledTimes(1);
    expect(recommendationSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledTimes(1);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('uses runs as the default export entity', async () => {
    const runSpy = jest
      .spyOn(service, 'findRuns')
      .mockResolvedValue(finalRunExportResult);

    await expect(
      service.findForExport({
        q: 'latest',
      }),
    ).resolves.toBe(finalRunExportResult.data);

    expect(runSpy).toHaveBeenCalledTimes(1);

    expect(runSpy).toHaveBeenCalledWith({
      page: 1,
      limit: 200,
      q: 'latest',
      taskType: undefined,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
