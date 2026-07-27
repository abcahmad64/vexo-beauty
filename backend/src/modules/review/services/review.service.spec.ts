import { ReviewEventPublisher } from '../events/review.event.publisher';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { ReviewService } from './review.service';

describe('ReviewService public contract', () => {
  const productRow = {
    id: 'product-1',
    name: 'سرم آبرسان',
    slug: 'hydrating-serum',
    sku: 'SERUM-1',
    is_active: true,
    status: 'ACTIVE',
    deleted_at: null,
  };

  const reviewRow = {
    id: 'review-1',
    user_id: 'user-1',
    product_id: 'product-1',
    rating: 5,
    title: 'عالی',
    comment: 'برای پوست خشک مناسب بود.',
    is_verified: true,
    created_at: new Date('2026-07-12T10:00:00.000Z'),
    updated_at: new Date('2026-07-12T10:30:00.000Z'),
    product_name: 'سرم آبرسان',
    product_slug: 'hydrating-serum',
    product_sku: 'SERUM-1',
    user_email: 'customer@example.com',
    user_first_name: 'احمد',
    user_last_name: 'رضایی',
  };

  let queryRaw: jest.Mock;

  let service: ReviewService;

  beforeEach(() => {
    queryRaw = jest.fn();

    service = new ReviewService(
      {
        $queryRaw: queryRaw,
      } as unknown as PrismaService,
      {
        publishCreated: jest.fn(),
        publishUpdated: jest.fn(),
        publishDeleted: jest.fn(),
        publishVerified: jest.fn(),
        publishUnverified: jest.fn(),
        publishProductRatingSynced: jest.fn(),
      } as unknown as ReviewEventPublisher,
    );
  });

  it('removes customer identifiers and email from public review rows', async () => {
    queryRaw
      .mockResolvedValueOnce([productRow])
      .mockResolvedValueOnce([reviewRow])
      .mockResolvedValueOnce([
        {
          count: 1,
        },
      ]);

    const result = (await service.findAllPublic('product-1', {
      page: 1,
      limit: 20,
      userId: 'other-user',
      isVerified: false,
    })) as {
      data: Array<Record<string, unknown>>;
      meta: {
        total: number;
      };
    };

    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'review-1',
        productId: 'product-1',
        rating: 5,
        author: {
          displayName: 'مشتری وکسو بیوتی',
        },
      }),
    );

    expect(result.data[0]).not.toHaveProperty('userId');
    expect(result.data[0]).not.toHaveProperty('user');
    expect(JSON.stringify(result.data[0])).not.toContain(
      'customer@example.com',
    );

    const queryRawCalls = queryRaw.mock.calls as unknown[][];
    const publicListQuery = queryRawCalls[1]?.[0];

    if (
      publicListQuery === null ||
      typeof publicListQuery !== 'object' ||
      Array.isArray(publicListQuery)
    ) {
      throw new Error('Expected the public review query object.');
    }

    const publicListSql = (publicListQuery as Record<string, unknown>).sql;

    if (typeof publicListSql !== 'string') {
      throw new Error('Expected the public review SQL string.');
    }

    expect(publicListSql).toContain('NULL::text AS user_email');
    expect(publicListSql).not.toContain('u."email"');
  });

  it('uses a neutral public author label when no customer name exists', async () => {
    queryRaw
      .mockResolvedValueOnce([productRow])
      .mockResolvedValueOnce([
        {
          ...reviewRow,
          user_email: null,
          user_first_name: null,
          user_last_name: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 1,
        },
      ]);

    const result = (await service.findAllPublic('product-1', {})) as {
      data: Array<{
        author: {
          displayName: string;
        };
      }>;
    };

    expect(result.data[0]?.author.displayName).toBe('مشتری وکسو بیوتی');
  });

  it('keeps the authenticated customer contract available for owned reviews', async () => {
    queryRaw.mockResolvedValueOnce([reviewRow]).mockResolvedValueOnce([
      {
        count: 1,
      },
    ]);

    const result = (await service.findAllForUser('user-1', {
      productId: 'product-1',
    })) as {
      data: Array<Record<string, unknown>>;
    };

    expect(result.data[0]).toMatchObject({
      userId: 'user-1',
      user: {
        email: 'customer@example.com',
      },
    });
  });
});
