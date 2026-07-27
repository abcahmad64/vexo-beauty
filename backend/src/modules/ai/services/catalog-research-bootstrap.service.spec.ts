import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../../core/prisma/prisma.service';

import { CatalogResearchBootstrapService } from './catalog-research-bootstrap.service';

type ResearchRunFixture = {
  id: string;
  productId: string | null;
  deletedAt: Date | null;
  startedAt: Date | null;
};

type ProductFixture = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  brandName: string | null;
  categoryId: string;
  categoryName: string | null;
  productTypeId: string | null;
  productTypeName: string | null;
  productModelId: string | null;
  productModelName: string | null;
  productModelCode: string | null;
};

type UpdateInput = {
  where: {
    id: string;
  };
  data: Record<string, unknown>;
};

type FindUniqueMock = jest.MockedFunction<
  (input: {
    where: {
      id: string;
    };
  }) => Promise<ResearchRunFixture | null>
>;

type UpdateMock = jest.MockedFunction<
  (input: UpdateInput) => Promise<Record<string, unknown>>
>;

type QueryRawMock = jest.MockedFunction<
  (...input: unknown[]) => Promise<ProductFixture[]>
>;

type PrismaMock = {
  catalogResearchRun: {
    findUnique: FindUniqueMock;
    update: UpdateMock;
  };
  $queryRaw: QueryRawMock;
};

const createPrismaMock = (): PrismaMock => ({
  catalogResearchRun: {
    findUnique: jest.fn<
      ReturnType<FindUniqueMock>,
      Parameters<FindUniqueMock>
    >(),
    update: jest.fn<ReturnType<UpdateMock>, Parameters<UpdateMock>>(),
  },
  $queryRaw: jest.fn<ReturnType<QueryRawMock>, Parameters<QueryRawMock>>(),
});

const createRun = (
  overrides: Partial<ResearchRunFixture> = {},
): ResearchRunFixture => ({
  id: 'research-run-1',
  productId: 'product-1',
  deletedAt: null,
  startedAt: null,
  ...overrides,
});

const createProduct = (
  overrides: Partial<ProductFixture> = {},
): ProductFixture => ({
  productId: 'product-1',
  name: 'Hydrating Serum',
  slug: 'hydrating-serum',
  sku: 'SERUM-1',
  brandId: 'brand-1',
  brandName: 'Vexo',
  categoryId: 'category-1',
  categoryName: 'Skin Care',
  productTypeId: 'type-1',
  productTypeName: 'Serum',
  productModelId: 'model-1',
  productModelName: 'Hydra Pro',
  productModelCode: 'HP-100',
  ...overrides,
});

const requireUpdateCall = (mock: UpdateMock, index: number): UpdateInput => {
  const call = mock.mock.calls[index];

  if (!call) {
    throw new Error(`Expected update call at index ${index}.`);
  }

  return call[0];
};

const requireDate = (value: unknown, field: string): Date => {
  if (!(value instanceof Date)) {
    throw new Error(`Expected ${field} to be a Date.`);
  }

  return value;
};

describe('CatalogResearchBootstrapService', () => {
  let prisma: PrismaMock;
  let service: CatalogResearchBootstrapService;

  beforeEach(() => {
    prisma = createPrismaMock();

    service = new CatalogResearchBootstrapService(
      prisma as unknown as PrismaService,
    );
  });

  it('rejects invalid identifiers before reading or mutating data', async () => {
    await expect(
      service.bootstrap({
        researchRunId: '   ',
        productId: 'product-1',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.bootstrap({
        researchRunId: 'research-run-1',
        productId: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.catalogResearchRun.findUnique).not.toHaveBeenCalled();
    expect(prisma.catalogResearchRun.update).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects missing and soft-deleted research runs without mutation', async () => {
    prisma.catalogResearchRun.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.bootstrap({
        researchRunId: 'research-run-1',
        productId: 'product-1',
      }),
    ).rejects.toThrow(new NotFoundException('پرونده تحقیق کاتالوگ پیدا نشد.'));

    prisma.catalogResearchRun.findUnique.mockResolvedValueOnce(
      createRun({
        deletedAt: new Date('2026-07-20T10:00:00.000Z'),
      }),
    );

    await expect(
      service.bootstrap({
        researchRunId: 'research-run-1',
        productId: 'product-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.catalogResearchRun.update).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a product mismatch before transitioning the research run', async () => {
    prisma.catalogResearchRun.findUnique.mockResolvedValue(
      createRun({
        productId: 'different-product',
      }),
    );

    await expect(
      service.bootstrap({
        researchRunId: 'research-run-1',
        productId: 'product-1',
      }),
    ).rejects.toThrow(
      new BadRequestException('محصول Job با پرونده تحقیق مطابقت ندارد.'),
    );

    expect(prisma.catalogResearchRun.update).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('transitions from PROCESSING to FAILED when the product is missing', async () => {
    prisma.catalogResearchRun.findUnique.mockResolvedValue(createRun());
    prisma.catalogResearchRun.update.mockResolvedValue({});
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      service.bootstrap({
        researchRunId: 'research-run-1',
        productId: 'product-1',
      }),
    ).rejects.toThrow(new NotFoundException('محصول مربوط به تحقیق پیدا نشد.'));

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.catalogResearchRun.update).toHaveBeenCalledTimes(2);

    const processingCall = requireUpdateCall(
      prisma.catalogResearchRun.update,
      0,
    );
    const failedCall = requireUpdateCall(prisma.catalogResearchRun.update, 1);

    const processingStartedAt = requireDate(
      processingCall.data.startedAt,
      'PROCESSING.startedAt',
    );
    const failedFinishedAt = requireDate(
      failedCall.data.finishedAt,
      'FAILED.finishedAt',
    );

    expect(processingStartedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(failedFinishedAt.getTime()).toBeLessThanOrEqual(Date.now());

    expect({
      ...processingCall,
      data: {
        ...processingCall.data,
        startedAt: 'DATE_VERIFIED',
      },
    }).toEqual({
      where: {
        id: 'research-run-1',
      },
      data: {
        status: 'PROCESSING',
        startedAt: 'DATE_VERIFIED',
        errorMessage: null,
        progressJson: {
          stage: 'IDENTITY_RESOLUTION',
          percent: 20,
        },
      },
    });

    expect({
      ...failedCall,
      data: {
        ...failedCall.data,
        finishedAt: 'DATE_VERIFIED',
      },
    }).toEqual({
      where: {
        id: 'research-run-1',
      },
      data: {
        status: 'FAILED',
        finishedAt: 'DATE_VERIFIED',
        errorMessage: 'Product not found.',
        progressJson: {
          stage: 'FAILED',
          percent: 20,
        },
      },
    });
  });

  it('preserves startedAt and prepares complete web-research identity', async () => {
    const startedAt = new Date('2026-07-20T12:00:00.000Z');

    prisma.catalogResearchRun.findUnique.mockResolvedValue(
      createRun({
        startedAt,
      }),
    );
    prisma.catalogResearchRun.update.mockResolvedValue({});
    prisma.$queryRaw.mockResolvedValue([createProduct()]);

    const result: Record<string, unknown> = await service.bootstrap({
      researchRunId: '  research-run-1  ',
      productId: '  product-1  ',
    });

    const normalizedIdentity = {
      productId: 'product-1',
      name: 'Hydrating Serum',
      slug: 'hydrating-serum',
      sku: 'SERUM-1',
      brand: {
        id: 'brand-1',
        name: 'Vexo',
      },
      category: {
        id: 'category-1',
        name: 'Skin Care',
      },
      productType: {
        id: 'type-1',
        name: 'Serum',
      },
      productModel: {
        id: 'model-1',
        name: 'Hydra Pro',
        modelCode: 'HP-100',
      },
    };

    const requestedQuery = 'Vexo HP-100 Hydra Pro Hydrating Serum Serum';

    expect(requireUpdateCall(prisma.catalogResearchRun.update, 0)).toEqual({
      where: {
        id: 'research-run-1',
      },
      data: {
        status: 'PROCESSING',
        startedAt,
        errorMessage: null,
        progressJson: {
          stage: 'IDENTITY_RESOLUTION',
          percent: 20,
        },
      },
    });

    expect(requireUpdateCall(prisma.catalogResearchRun.update, 1)).toEqual({
      where: {
        id: 'research-run-1',
      },
      data: {
        status: 'READY_FOR_WEB_RESEARCH',
        requestedQuery,
        normalizedIdentity,
        progressJson: {
          stage: 'READY_FOR_WEB_RESEARCH',
          percent: 30,
        },
        summaryJson: {
          productResolved: true,
          brandResolved: true,
          modelResolved: true,
          nextStage: 'TRUSTED_SOURCE_RESEARCH',
        },
      },
    });

    expect(result).toEqual({
      task: 'catalog.research.bootstrap',
      researchRunId: 'research-run-1',
      productId: 'product-1',
      status: 'READY_FOR_WEB_RESEARCH',
      requestedQuery,
      normalizedIdentity,
    });
  });

  it('omits missing optional identity values from the generated query', async () => {
    prisma.catalogResearchRun.findUnique.mockResolvedValue(createRun());
    prisma.catalogResearchRun.update.mockResolvedValue({});
    prisma.$queryRaw.mockResolvedValue([
      createProduct({
        brandName: null,
        productTypeId: null,
        productTypeName: null,
        productModelId: null,
        productModelName: null,
        productModelCode: null,
      }),
    ]);

    const result: Record<string, unknown> = await service.bootstrap({
      researchRunId: 'research-run-1',
      productId: 'product-1',
    });

    expect(result).toEqual({
      task: 'catalog.research.bootstrap',
      researchRunId: 'research-run-1',
      productId: 'product-1',
      status: 'READY_FOR_WEB_RESEARCH',
      requestedQuery: 'Hydrating Serum',
      normalizedIdentity: {
        productId: 'product-1',
        name: 'Hydrating Serum',
        slug: 'hydrating-serum',
        sku: 'SERUM-1',
        brand: {
          id: 'brand-1',
          name: null,
        },
        category: {
          id: 'category-1',
          name: 'Skin Care',
        },
        productType: {
          id: null,
          name: null,
        },
        productModel: {
          id: null,
          name: null,
          modelCode: null,
        },
      },
    });

    expect(requireUpdateCall(prisma.catalogResearchRun.update, 1)).toEqual({
      where: {
        id: 'research-run-1',
      },
      data: {
        status: 'READY_FOR_WEB_RESEARCH',
        requestedQuery: 'Hydrating Serum',
        normalizedIdentity: {
          productId: 'product-1',
          name: 'Hydrating Serum',
          slug: 'hydrating-serum',
          sku: 'SERUM-1',
          brand: {
            id: 'brand-1',
            name: null,
          },
          category: {
            id: 'category-1',
            name: 'Skin Care',
          },
          productType: {
            id: null,
            name: null,
          },
          productModel: {
            id: null,
            name: null,
            modelCode: null,
          },
        },
        progressJson: {
          stage: 'READY_FOR_WEB_RESEARCH',
          percent: 30,
        },
        summaryJson: {
          productResolved: true,
          brandResolved: false,
          modelResolved: false,
          nextStage: 'TRUSTED_SOURCE_RESEARCH',
        },
      },
    });
  });
});
