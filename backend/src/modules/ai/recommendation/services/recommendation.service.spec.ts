import { CacheService } from '../../../../core/cache/cache.service';
import { CACHE_TTL } from '../../../../core/cache/cache-ttl.constants';
import { PrismaService } from '../../../../core/prisma/prisma.service';

import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  const createRow = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: 'product-1',
    name: 'Hydrating Serum',
    slug: 'hydrating-serum',
    sku: 'SERUM-1',
    price: '125000',
    compare_price: '150000',
    brand_id: 'brand-1',
    brand_name: 'Vexo',
    brand_slug: 'vexo',
    category_id: 'category-1',
    category_name: 'Serum',
    category_slug: 'serum',
    image_url: '/media/serum.jpg',
    image_alt: 'Hydrating serum',
    score: 42,
    ...overrides,
  });

  let queryRaw: jest.Mock;
  let remember: jest.Mock;
  let service: RecommendationService;

  beforeEach(() => {
    queryRaw = jest.fn();

    remember = jest.fn(
      async (
        _key: string,
        _ttlSeconds: number,
        factory: () => Promise<unknown>,
      ): Promise<unknown> => factory(),
    );

    service = new RecommendationService(
      {
        $queryRaw: queryRaw,
      } as unknown as PrismaService,
      {
        remember,
      } as unknown as CacheService,
    );
  });

  it('uses the default similar-products cache contract and maps decimal-like values', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        price: {
          toString: () => '125000.50',
        },
        compare_price: {
          toString: () => '150000.75',
        },
        score: 42n,
      }),
    ]);

    const result = await service.similarProducts({});

    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith(
      'recommendation:similar:none:none:none:none:12',
      CACHE_TTL.PRODUCT_LIST,
      expect.any(Function),
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(result).toEqual([
      {
        id: 'product-1',
        name: 'Hydrating Serum',
        slug: 'hydrating-serum',
        sku: 'SERUM-1',
        price: '125000.50',
        comparePrice: '150000.75',
        brand: {
          id: 'brand-1',
          name: 'Vexo',
          slug: 'vexo',
        },
        category: {
          id: 'category-1',
          name: 'Serum',
          slug: 'serum',
        },
        image: {
          url: '/media/serum.jpg',
          alt: 'Hydrating serum',
        },
        score: 42,
        reason: 'similar',
      },
    ]);
  });

  it('normalizes the maximum limit and includes all similar-product filters in the cache key', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        price: null,
        compare_price: undefined,
        score: null,
      }),
    ]);

    const result = await service.similarProducts({
      productId: 'product-1',
      categoryId: 'category-1',
      brandId: 'brand-1',
      q: 'serum',
      limit: 100,
    });

    expect(remember).toHaveBeenCalledWith(
      'recommendation:similar:product-1:category-1:brand-1:serum:50',
      CACHE_TTL.PRODUCT_LIST,
      expect.any(Function),
    );

    expect(result[0]).toMatchObject({
      price: '0',
      comparePrice: null,
      score: 0,
      reason: 'similar',
    });
  });

  it('normalizes the minimum limit for best sellers and maps object scores', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        score: {
          toString: () => '31',
        },
      }),
    ]);

    const result = await service.bestSellers({
      categoryId: 'category-1',
      limit: 0,
    });

    expect(remember).toHaveBeenCalledWith(
      'recommendation:best-sellers:category-1:1',
      CACHE_TTL.PRODUCT_LIST,
      expect.any(Function),
    );

    expect(result[0]).toMatchObject({
      score: 31,
      reason: 'best_seller',
    });
  });

  it('uses the short cache contract for trending recommendations', async () => {
    queryRaw.mockResolvedValue([createRow()]);

    const result = await service.trending({});

    expect(remember).toHaveBeenCalledWith(
      'recommendation:trending:all:12',
      CACHE_TTL.SHORT,
      expect.any(Function),
    );

    expect(result[0]?.reason).toBe('trending');
  });

  it('retrieves new arrivals directly without using the cache', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        id: 'new-product',
      }),
    ]);

    const result = await service.newArrivals({
      categoryId: 'category-1',
      limit: 5,
    });

    expect(remember).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(result[0]).toMatchObject({
      id: 'new-product',
      reason: 'new_arrival',
    });
  });

  it('retrieves cart-related recommendations directly and assigns their reason', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        id: 'cart-related-product',
      }),
    ]);

    const result = await service.cartRelated('user-1', {
      limit: 8,
    });

    expect(remember).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(result[0]).toMatchObject({
      id: 'cart-related-product',
      reason: 'cart_related',
    });
  });

  it('retrieves personalized recommendations directly and assigns their reason', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        id: 'personalized-product',
        brand_name: null,
        brand_slug: null,
        category_name: null,
        category_slug: null,
        image_url: null,
        image_alt: null,
      }),
    ]);

    const result = await service.personalized('user-1', {});

    expect(remember).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(result[0]).toMatchObject({
      id: 'personalized-product',
      brand: {
        id: 'brand-1',
        name: null,
        slug: null,
      },
      category: {
        id: 'category-1',
        name: null,
        slug: null,
      },
      image: {
        url: null,
        alt: null,
      },
      reason: 'personalized',
    });
  });

  it('preserves database row order when mapping recommendations', async () => {
    queryRaw.mockResolvedValue([
      createRow({
        id: 'product-a',
        score: 90,
      }),
      createRow({
        id: 'product-b',
        score: 70,
      }),
    ]);

    const result = await service.newArrivals({});

    expect(result.map((product) => product.id)).toEqual([
      'product-a',
      'product-b',
    ]);

    expect(result.map((product) => product.score)).toEqual([90, 70]);
  });

  it('propagates cached recommendation query failures', async () => {
    const failure = new Error('Recommendation query failed');

    queryRaw.mockRejectedValue(failure);

    await expect(service.similarProducts({})).rejects.toBe(failure);

    expect(remember).toHaveBeenCalledTimes(1);
  });

  it('propagates direct recommendation query failures', async () => {
    const failure = new Error('Personalized query failed');

    queryRaw.mockRejectedValue(failure);

    await expect(service.personalized('user-1', {})).rejects.toBe(failure);

    expect(remember).not.toHaveBeenCalled();
  });
});
