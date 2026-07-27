import type { PrismaService } from '../../../core/prisma/prisma.service';

import type {
  AiHybridRetrievalService,
  AiRankedDocument,
  AiRetrievalDocument,
} from './ai-hybrid-retrieval.service';

import {
  type AiGroundingEvidence,
  AiKnowledgeRetrievalService,
} from './ai-knowledge-retrieval.service';

type ApprovedKnowledgeFixture = {
  id: string;
  productId: string | null;
  fieldPath: string;
  normalizedValue: unknown;
  displayValue: string | null;
  unit: string | null;
  confidence: unknown;
  sourceUrlsJson: unknown;
  approvedAt: Date;
  updatedAt: Date;
};

type KnowledgeDocumentFixture = {
  id: string;
  key: string;
  title: string;
  content: string;
  sourceType: string;
  language: string;
  tagsJson: unknown;
  updatedAt: Date;
};

type QueryRawResult = ApprovedKnowledgeFixture[] | KnowledgeDocumentFixture[];

type QueryRawMock = jest.MockedFunction<
  (...input: unknown[]) => Promise<QueryRawResult>
>;

type RankInput = {
  query: string;
  documents: Array<AiRetrievalDocument<AiGroundingEvidence>>;
  limit: number;
  instruction?: string;
};

type RankMock = jest.MockedFunction<
  (input: RankInput) => Promise<Array<AiRankedDocument<AiGroundingEvidence>>>
>;

type PrismaMock = {
  $queryRaw: QueryRawMock;
};

type HybridMock = {
  rank: RankMock;
};

const createApprovedKnowledge = (
  overrides: Partial<ApprovedKnowledgeFixture> = {},
): ApprovedKnowledgeFixture => ({
  id: 'approved-1',
  productId: 'product-1',
  fieldPath: 'ingredients.hyaluronicAcid',
  normalizedValue: {
    value: '2%',
  },
  displayValue: '2%',
  unit: null,
  confidence: '0.93',
  sourceUrlsJson: [
    ' https://official.example/product ',
    '',
    42,
    'https://brand.example/spec',
  ],
  approvedAt: new Date('2026-07-20T10:00:00.000Z'),
  updatedAt: new Date('2026-07-21T10:00:00.000Z'),
  ...overrides,
});

const createKnowledgeDocument = (
  overrides: Partial<KnowledgeDocumentFixture> = {},
): KnowledgeDocumentFixture => ({
  id: 'knowledge-1',
  key: 'skin-care-policy',
  title: 'راهنمای مراقبت پوستی',
  content: 'این سند برای راهنمایی عمومی فروشگاه استفاده می‌شود.',
  sourceType: 'ADMIN',
  language: 'fa',
  tagsJson: ['skin-care'],
  updatedAt: new Date('2026-07-22T10:00:00.000Z'),
  ...overrides,
});

const createMocks = (): {
  prisma: PrismaMock;
  hybrid: HybridMock;
} => ({
  prisma: {
    $queryRaw: jest.fn<ReturnType<QueryRawMock>, Parameters<QueryRawMock>>(),
  },
  hybrid: {
    rank: jest.fn<ReturnType<RankMock>, Parameters<RankMock>>(),
  },
});

const requireRankInput = (mock: RankMock): RankInput => {
  const call = mock.mock.calls[0];

  if (!call) {
    throw new Error('Expected hybrid rank to be called.');
  }

  return call[0];
};

const rankDocuments = (
  input: RankInput,
): Array<AiRankedDocument<AiGroundingEvidence>> =>
  input.documents.map((document, index) => ({
    ...document,
    semanticScore: 0.9 - index * 0.1,
    rerankerScore: null,
    finalScore: 0.95 - index * 0.1,
  }));

describe('AiKnowledgeRetrievalService', () => {
  let prisma: PrismaMock;
  let hybrid: HybridMock;
  let service: AiKnowledgeRetrievalService;

  beforeEach(() => {
    const mocks = createMocks();

    prisma = mocks.prisma;
    hybrid = mocks.hybrid;

    service = new AiKnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      hybrid as unknown as AiHybridRetrievalService,
    );
  });

  it('returns an empty result without ranking when both data sources are empty', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await service.retrieve({
      query: 'hydrating serum',
      productIds: ['product-1'],
    });

    expect(result).toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(hybrid.rank).not.toHaveBeenCalled();
  });

  it('skips the approved-product query when no product identifiers are provided', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.retrieve({
      query: 'راهنمای پوست',
      productIds: [],
    });

    expect(result).toEqual([]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(hybrid.rank).not.toHaveBeenCalled();
  });

  it('maps approved product knowledge and admin documents into ranked grounding evidence', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createApprovedKnowledge()])
      .mockResolvedValueOnce([createKnowledgeDocument()]);

    hybrid.rank.mockImplementation((input) =>
      Promise.resolve(rankDocuments(input)),
    );

    const result = await service.retrieve({
      query: 'hyaluronic acid serum',
      productIds: ['product-1'],
      limit: 5,
    });

    const rankInput = requireRankInput(hybrid.rank);

    expect(rankInput.query).toBe('hyaluronic acid serum');
    expect(rankInput.limit).toBe(5);
    expect(rankInput.instruction).toBe(
      'برای پاسخ دقیق فروشگاه، مرتبط‌ترین دانش تأییدشده محصول و سند مدیریتی را انتخاب کن.',
    );

    expect(rankInput.documents).toEqual([
      {
        id: 'approved:approved-1',
        text: 'ingredients.hyaluronicAcid: 2%',
        fingerprint: '2026-07-21T10:00:00.000Z',
        lexicalScore: 8,
        popularityScore: 0.93,
        payload: {
          id: 'approved-1',
          kind: 'APPROVED_PRODUCT_KNOWLEDGE',
          productId: 'product-1',
          title: 'ingredients.hyaluronicAcid',
          content: 'ingredients.hyaluronicAcid: 2%',
          confidence: 0.93,
          sourceUrls: [
            'https://official.example/product',
            'https://brand.example/spec',
          ],
          relevanceScore: 0,
        },
      },
      {
        id: 'knowledge:knowledge-1',
        text:
          'راهنمای مراقبت پوستی\n' +
          'این سند برای راهنمایی عمومی فروشگاه استفاده می‌شود.',
        fingerprint: '2026-07-22T10:00:00.000Z',
        lexicalScore: 2,
        popularityScore: 0,
        payload: {
          id: 'knowledge-1',
          kind: 'ADMIN_KNOWLEDGE_DOCUMENT',
          productId: null,
          title: 'راهنمای مراقبت پوستی',
          content: 'این سند برای راهنمایی عمومی فروشگاه استفاده می‌شود.',
          confidence: null,
          sourceUrls: [],
          relevanceScore: 0,
        },
      },
    ]);

    expect(result).toEqual([
      {
        ...rankInput.documents[0]?.payload,
        relevanceScore: 0.95,
      },
      {
        ...rankInput.documents[1]?.payload,
        relevanceScore: 0.85,
      },
    ]);
  });

  it('caps the requested ranking limit at twelve', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createApprovedKnowledge()])
      .mockResolvedValueOnce([]);

    hybrid.rank.mockImplementation((input) =>
      Promise.resolve(rankDocuments(input)),
    );

    await service.retrieve({
      query: 'serum',
      productIds: ['product-1'],
      limit: 99,
    });

    expect(requireRankInput(hybrid.rank).limit).toBe(12);
  });

  it('normalizes fallback values and limits approved source URLs to twelve', async () => {
    const sourceUrls = Array.from(
      {
        length: 15,
      },
      (_, index) => ` https://source.example/${index + 1} `,
    );

    prisma.$queryRaw
      .mockResolvedValueOnce([
        createApprovedKnowledge({
          displayValue: '   ',
          normalizedValue: {
            amount: 25,
          },
          unit: ' ml ',
          confidence: {
            invalid: true,
          },
          sourceUrlsJson: [...sourceUrls, null, 12, ''],
        }),
      ])
      .mockResolvedValueOnce([]);

    hybrid.rank.mockImplementation((input) =>
      Promise.resolve(rankDocuments(input)),
    );

    const result = await service.retrieve({
      query: 'amount',
      productIds: ['product-1'],
    });

    const document = requireRankInput(hybrid.rank).documents[0];

    expect(document).toEqual({
      id: 'approved:approved-1',
      text: 'ingredients.hyaluronicAcid: {"amount":25} ml',
      fingerprint: '2026-07-21T10:00:00.000Z',
      lexicalScore: 8,
      popularityScore: Number.NaN,
      payload: {
        id: 'approved-1',
        kind: 'APPROVED_PRODUCT_KNOWLEDGE',
        productId: 'product-1',
        title: 'ingredients.hyaluronicAcid',
        content: 'ingredients.hyaluronicAcid: {"amount":25} ml',
        confidence: null,
        sourceUrls: sourceUrls.slice(0, 12).map((value) => value.trim()),
        relevanceScore: 0,
      },
    });

    expect(result[0]?.confidence).toBeNull();
    expect(result[0]?.sourceUrls).toHaveLength(12);
  });

  it('applies per-item and total context budgets after ranking', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createApprovedKnowledge()])
      .mockResolvedValueOnce([createKnowledgeDocument()]);

    hybrid.rank.mockImplementation((input) => {
      const approved = input.documents[0];
      const knowledge = input.documents[1];

      if (!approved || !knowledge) {
        throw new Error('Expected two retrieval documents.');
      }

      const ranked: Array<AiRankedDocument<AiGroundingEvidence>> = [];

      for (let index = 0; index < 12; index += 1) {
        const source = index % 2 === 0 ? approved : knowledge;
        const kind =
          index % 2 === 0
            ? 'APPROVED_PRODUCT_KNOWLEDGE'
            : 'ADMIN_KNOWLEDGE_DOCUMENT';

        ranked.push({
          ...source,
          id: `${source.id}-${index}`,
          payload: {
            ...source.payload,
            id: `${source.payload.id}-${index}`,
            kind,
            content: 'x'.repeat(5_000),
          },
          semanticScore: 1,
          rerankerScore: null,
          finalScore: 1 - index * 0.01,
        });
      }

      return Promise.resolve(ranked);
    });

    const result = await service.retrieve({
      query: 'budget',
      productIds: ['product-1'],
      limit: 12,
    });

    const totalLength = result.reduce(
      (sum, item) => sum + item.content.length,
      0,
    );

    expect(totalLength).toBeLessThanOrEqual(12_000);

    for (const item of result) {
      const maximum =
        item.kind === 'APPROVED_PRODUCT_KNOWLEDGE' ? 1_200 : 2_400;

      expect(item.content.length).toBeLessThanOrEqual(maximum);
    }
  });

  it('fails safely when a database query rejects', async () => {
    prisma.$queryRaw
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce([]);

    const result = await service.retrieve({
      query: 'serum',
      productIds: ['product-1'],
    });

    expect(result).toEqual([]);
    expect(hybrid.rank).not.toHaveBeenCalled();
  });

  it('fails safely when hybrid ranking rejects', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([createApprovedKnowledge()])
      .mockResolvedValueOnce([]);

    hybrid.rank.mockRejectedValueOnce(new Error('ranking unavailable'));

    const result = await service.retrieve({
      query: 'serum',
      productIds: ['product-1'],
    });

    expect(result).toEqual([]);
    expect(hybrid.rank).toHaveBeenCalledTimes(1);
  });
});
