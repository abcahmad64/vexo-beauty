import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { AiProductSnapshot } from '../interfaces/ai-context.interface';

import { AiContextService } from './ai-context.service';

describe('AiContextService', () => {
  const createProductRow = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: 'product-1',
    name: 'Hydrating Serum',
    slug: 'hydrating-serum',
    sku: 'SERUM-1',
    description: 'Daily hydrating serum.',
    short_description: 'Lightweight daily care.',
    price: '125000',
    compare_price: '150000',
    brand_name: 'Vexo',
    category_name: 'Serum',
    average_rating: '4.5',
    review_count: 12,
    view_count: 140,
    is_active: true,
    status: 'ACTIVE',
    ...overrides,
  });

  const createSnapshot = (productId: string): AiProductSnapshot => ({
    product: {
      id: productId,
      name: `Product ${productId}`,
      slug: `product-${productId}`,
      sku: `SKU-${productId}`,
      price: '100000',
      comparePrice: null,
      reviewCount: 0,
      viewCount: 0,
      isActive: true,
      status: 'ACTIVE',
    },
    variants: [],
    images: [],
    attributes: [],
    inventory: [],
    reviews: {
      averageRating: null,
      reviewCount: 0,
      latestComments: [],
    },
  });

  let queryRaw: jest.Mock;
  let service: AiContextService;

  beforeEach(() => {
    queryRaw = jest.fn();

    service = new AiContextService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps and filters catalog products using the default result limit', async () => {
    queryRaw.mockResolvedValue([
      createProductRow({
        description: '  Rich hydrating serum.  ',
        short_description: '  Daily care.  ',
        price: {
          toString: () => '125000.50',
        },
        compare_price: {
          toString: () => '150000',
        },
        average_rating: {
          toString: () => '4.7',
        },
        review_count: 15n,
        view_count: {
          toString: () => '250',
        },
      }),
      createProductRow({
        id: 'demo-product',
        name: 'Demo Serum',
      }),
      createProductRow({
        id: 'mojibake-product',
        name: 'Ø³Ø±Ù…',
      }),
      createProductRow({
        id: 'free-product',
        price: 0,
      }),
      createProductRow({
        id: 'inactive-product',
        is_active: false,
      }),
      createProductRow({
        id: 'draft-product',
        status: 'DRAFT',
      }),
    ]);

    const result = await service.searchCatalog({
      query: 'سرم آبرسان',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      total: 1,
      products: [
        {
          id: 'product-1',
          name: 'Hydrating Serum',
          slug: 'hydrating-serum',
          sku: 'SERUM-1',
          description: 'Rich hydrating serum.',
          shortDescription: 'Daily care.',
          price: '125000.50',
          comparePrice: '150000',
          brandName: 'Vexo',
          categoryName: 'Serum',
          averageRating: '4.7',
          reviewCount: 15,
          viewCount: 250,
          isActive: true,
          status: 'ACTIVE',
        },
      ],
    });
  });

  it('clamps an oversized catalog result limit to twenty', async () => {
    queryRaw.mockResolvedValue(
      Array.from(
        {
          length: 25,
        },
        (_, index) =>
          createProductRow({
            id: `product-${index + 1}`,
            name: `Valid Product ${index + 1}`,
            slug: `valid-product-${index + 1}`,
            sku: `SKU-${index + 1}`,
          }),
      ),
    );

    const result = await service.searchCatalog({
      limit: 100,
    });

    expect(result.products).toHaveLength(20);
    expect(result.total).toBe(20);
    expect(result.products[0]?.id).toBe('product-1');
    expect(result.products[19]?.id).toBe('product-20');
  });

  it('clamps a catalog result limit below one to one', async () => {
    queryRaw.mockResolvedValue([
      createProductRow({
        id: 'product-a',
      }),
      createProductRow({
        id: 'product-b',
      }),
    ]);

    const result = await service.searchCatalog({
      limit: 0,
    });

    expect(result.products).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.products[0]?.id).toBe('product-a');
  });

  it('throws when a requested product snapshot does not exist', async () => {
    queryRaw.mockResolvedValue([]);

    await expect(
      service.getProductSnapshot('missing-product'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('builds a complete normalized product snapshot', async () => {
    const createdAt = new Date('2026-07-12T10:00:00.000Z');

    queryRaw
      .mockResolvedValueOnce([
        createProductRow({
          description: '  Rich serum description.  ',
          short_description: 'Ø³Ø±Ù…',
          price: {
            toString: () => '125000.50',
          },
          compare_price: null,
          average_rating: {
            toString: () => '4.8',
          },
          review_count: 3n,
          view_count: {
            toString: () => '25',
          },
        }),
      ])
      .mockResolvedValueOnce([
        {
          id: 'variant-1',
          product_id: 'product-1',
          sku: 'VARIANT-1',
          name: '  Large Size  ',
          slug: 'large-size',
          price: {
            toString: () => '130000',
          },
          compare_price: null,
          weight: 100,
          image_url: '/variant.jpg',
          is_active: true,
        },
        {
          id: 'variant-test',
          product_id: 'product-1',
          sku: 'TEST-VARIANT',
          name: 'Test Variant',
          slug: 'test-variant',
          price: '1',
          compare_price: null,
          weight: null,
          image_url: null,
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'image-1',
          product_id: 'product-1',
          url: '/primary.jpg',
          alt_text: '  Primary product image  ',
          sort_order: 0,
          is_primary: true,
        },
        {
          id: 'image-2',
          product_id: 'product-1',
          url: '/secondary.jpg',
          alt_text: 'ØªØµÙˆÛŒØ±',
          sort_order: 1,
          is_primary: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          name: 'Skin Type',
          value: 'Dry',
        },
        {
          name: 'Demo Attribute',
          value: 'Sample',
        },
        {
          name: 'Ø¹Ø·Ø±',
          value: 'Fresh',
        },
      ])
      .mockResolvedValueOnce([
        {
          variant_id: 'variant-1',
          quantity: 10n,
          reserved_quantity: 3,
        },
        {
          variant_id: 'variant-2',
          quantity: 2,
          reserved_quantity: 5n,
        },
      ])
      .mockResolvedValueOnce([
        {
          rating: 5,
          title: '  Excellent  ',
          comment: '  Works well.  ',
          is_verified: true,
          created_at: createdAt,
        },
        {
          rating: 1,
          title: 'Ø¨Ø¯',
          comment: 'Unreadable review title',
          is_verified: false,
          created_at: createdAt,
        },
      ])
      .mockResolvedValueOnce([
        {
          average_rating: {
            toString: () => '4.5',
          },
          review_count: 2n,
        },
      ]);

    const result = await service.getProductSnapshot('hydrating-serum');

    expect(queryRaw).toHaveBeenCalledTimes(7);

    expect(result.product).toEqual({
      id: 'product-1',
      name: 'Hydrating Serum',
      slug: 'hydrating-serum',
      sku: 'SERUM-1',
      description: 'Rich serum description.',
      shortDescription: null,
      price: '125000.50',
      comparePrice: null,
      brandName: 'Vexo',
      categoryName: 'Serum',
      averageRating: '4.8',
      reviewCount: 3,
      viewCount: 25,
      isActive: true,
      status: 'ACTIVE',
    });

    expect(result.variants).toEqual([
      {
        id: 'variant-1',
        productId: 'product-1',
        sku: 'VARIANT-1',
        name: 'Large Size',
        slug: 'large-size',
        price: '130000',
        comparePrice: null,
        weight: 100,
        imageUrl: '/variant.jpg',
        isActive: true,
      },
    ]);

    expect(result.images).toEqual([
      {
        id: 'image-1',
        productId: 'product-1',
        url: '/primary.jpg',
        altText: 'Primary product image',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        id: 'image-2',
        productId: 'product-1',
        url: '/secondary.jpg',
        altText: null,
        sortOrder: 1,
        isPrimary: false,
      },
    ]);

    expect(result.attributes).toEqual([
      {
        name: 'Skin Type',
        value: 'Dry',
      },
    ]);

    expect(result.inventory).toEqual([
      {
        variantId: 'variant-1',
        quantity: 10,
        reservedQuantity: 3,
        availableQuantity: 7,
      },
      {
        variantId: 'variant-2',
        quantity: 2,
        reservedQuantity: 5,
        availableQuantity: 0,
      },
    ]);

    expect(result.reviews).toEqual({
      averageRating: '4.5',
      reviewCount: 2,
      latestComments: [
        {
          rating: 5,
          title: 'Excellent',
          comment: 'Works well.',
          isVerified: true,
          createdAt,
        },
      ],
    });
  });

  it('normalizes and deduplicates product identifiers before loading snapshots', async () => {
    const snapshotSpy = jest
      .spyOn(service, 'getProductSnapshot')
      .mockImplementation((productId: string): Promise<AiProductSnapshot> =>
        Promise.resolve(createSnapshot(productId)),
      );

    const result = await service.getProductSnapshots([
      ' product-1 ',
      '',
      'product-1',
      'product-2',
      '   ',
    ]);

    expect(snapshotSpy).toHaveBeenCalledTimes(2);
    expect(snapshotSpy).toHaveBeenNthCalledWith(1, 'product-1');
    expect(snapshotSpy).toHaveBeenNthCalledWith(2, 'product-2');

    expect(result.map((snapshot) => snapshot.product.id)).toEqual([
      'product-1',
      'product-2',
    ]);
  });

  it('maps and filters user behavior context records', async () => {
    const purchasedAt = new Date('2026-07-10T08:00:00.000Z');

    queryRaw
      .mockResolvedValueOnce([
        {
          product_id: 'cart-product',
          variant_id: 'variant-1',
          product_name: 'Valid Cart Product',
          sku: 'CART-1',
          quantity: 2,
          price: {
            toString: () => '99000.50',
          },
        },
        {
          product_id: 'test-cart-product',
          variant_id: null,
          product_name: 'Demo Cart Product',
          sku: 'DEMO-1',
          quantity: 1,
          price: '1',
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 'wishlist-product',
          product_name: 'Valid Wishlist Product',
          sku: 'WISH-1',
        },
        {
          product_id: 'mojibake-product',
          product_name: 'ØÙ Wishlist',
          sku: 'WISH-2',
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 'purchased-product',
          product_name: 'Purchased Serum',
          sku: 'ORDER-1',
          quantity: 3,
          price: '120000',
          created_at: purchasedAt,
        },
        {
          product_id: 'test-order-product',
          product_name: 'Sample Purchased Product',
          sku: 'SAMPLE-1',
          quantity: 1,
          price: '1',
          created_at: purchasedAt,
        },
      ]);

    const result = await service.getUserBehaviorContext('user-1');

    expect(queryRaw).toHaveBeenCalledTimes(3);

    expect(result).toEqual({
      cartItems: [
        {
          productId: 'cart-product',
          variantId: 'variant-1',
          productName: 'Valid Cart Product',
          sku: 'CART-1',
          quantity: 2,
          price: '99000.50',
        },
      ],
      wishlistItems: [
        {
          productId: 'wishlist-product',
          productName: 'Valid Wishlist Product',
          sku: 'WISH-1',
        },
      ],
      recentPurchasedProducts: [
        {
          productId: 'purchased-product',
          productName: 'Purchased Serum',
          sku: 'ORDER-1',
          quantity: 3,
          price: '120000',
          createdAt: purchasedAt,
        },
      ],
    });
  });

  it('builds a filtered Persian store snapshot', async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          id: 'category-1',
          name: 'Skin Care',
          slug: 'skin-care',
        },
        {
          id: 'category-demo',
          name: 'Demo Category',
          slug: 'demo-category',
        },
        {
          id: 'category-bad',
          name: 'Ø¯Ø³ØªÙ‡',
          slug: 'bad-category',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'brand-1',
          name: 'Vexo',
          slug: 'vexo',
        },
        {
          id: 'brand-test',
          name: 'Test Brand',
          slug: 'test-brand',
        },
      ]);

    const topProduct = createSnapshot('top-product').product;

    const searchCatalogSpy = jest
      .spyOn(service, 'searchCatalog')
      .mockResolvedValue({
        products: [topProduct],
        total: 1,
      });

    const result = await service.getStoreSnapshot();

    expect(searchCatalogSpy).toHaveBeenCalledWith({
      limit: 10,
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      language: 'fa',
      categories: [
        {
          id: 'category-1',
          name: 'Skin Care',
          slug: 'skin-care',
        },
      ],
      brands: [
        {
          id: 'brand-1',
          name: 'Vexo',
          slug: 'vexo',
        },
      ],
      topProducts: [topProduct],
    });
  });

  it('propagates catalog query failures', async () => {
    const failure = new Error('Catalog query failed');

    queryRaw.mockRejectedValue(failure);

    await expect(
      service.searchCatalog({
        query: 'serum',
      }),
    ).rejects.toBe(failure);
  });

  it('propagates nested snapshot query failures', async () => {
    const failure = new Error('Variant query failed');

    queryRaw
      .mockResolvedValueOnce([createProductRow()])
      .mockRejectedValueOnce(failure)
      .mockResolvedValue([]);

    await expect(service.getProductSnapshot('product-1')).rejects.toBe(failure);
  });
});
