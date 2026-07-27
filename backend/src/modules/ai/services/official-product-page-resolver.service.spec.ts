import { OfficialProductPageResolverService } from './official-product-page-resolver.service';

import type { PrismaService } from '../../../core/prisma/prisma.service';

import type { AiProvider } from '../interfaces/ai-provider.interface';

const identity = {
  productId: 'product-1',
  productName: 'Orion Precision Trimmer 900',
  productSku: 'VEXO-ORION-OX900-15',
  canonicalUrl: null,
  brandId: 'brand-1',
  brandName: 'Orion',
  brandWebsite: 'https://www.orion.example',
  productModelId: 'model-1',
  productModelName: 'OX900/15',
  productModelCode: 'OX900/15',
  variantIdentifiers: ['VEXO-ORION-OX900-15', 'OX900/15'],
};

const createPrisma = () => ({
  catalogResearchSource: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  catalogApprovedKnowledge: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

const createProvider = (): AiProvider => ({
  generate: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      aliases: ['OX900/15', 'OX900_15', 'OX900-15'],
      searchQueries: ['Orion OX900/15'],
      officialDomainCandidates: [],
    }),
    model: 'qwen3.5:9b',
    runLogId: 'run-1',
  }),
});

const jsonResponse = (
  body: string,
  contentType: string,
  status = 200,
): Response =>
  new Response(body, {
    status,
    headers: {
      'content-type': contentType,
    },
  });

describe('OfficialProductPageResolverService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('discovers a model-specific candidate from an official sitemap', async () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    jest
      .spyOn(
        service as unknown as {
          assertPublicUrl(url: string): Promise<void>;
        },
        'assertPublicUrl',
      )
      .mockResolvedValue(undefined);

    fetchSpy.mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.endsWith('/robots.txt')) {
        return Promise.resolve(
          jsonResponse(
            'Sitemap: https://www.orion.example/sitemap-index.xml',
            'text/plain',
          ),
        );
      }

      if (url.endsWith('/sitemap-index.xml')) {
        return Promise.resolve(
          jsonResponse(
            '<sitemapindex><sitemap><loc>https://www.orion.example/products.xml</loc></sitemap></sitemapindex>',
            'application/xml',
          ),
        );
      }

      if (url.endsWith('/products.xml')) {
        return Promise.resolve(
          jsonResponse(
            [
              '<urlset>',
              '<url><loc>https://www.orion.example/products/OX800_10</loc></url>',
              '<url><loc>https://www.orion.example/products/OX900_15/precision-trimmer</loc></url>',
              '</urlset>',
            ].join(''),
            'application/xml',
          ),
        );
      }

      if (url === 'https://www.orion.example/') {
        return Promise.resolve(
          jsonResponse('<html><title>Orion</title></html>', 'text/html'),
        );
      }

      return Promise.resolve(jsonResponse('', 'application/xml', 404));
    });

    const result = await service.discover(identity);

    expect(result.status).toBe('CANDIDATES_DISCOVERED');
    expect(result.aiModel).toBe('qwen3.5:9b');
    expect(result.candidates[0]).toMatchObject({
      url: 'https://www.orion.example/products/OX900_15/precision-trimmer',
      discoveryMethod: 'OFFICIAL_SITEMAP',
      officialHostname: 'www.orion.example',
    });
  });

  it('rejects generic official product paths that contain no supplied identifier', async () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    jest
      .spyOn(
        service as unknown as {
          assertPublicUrl(url: string): Promise<void>;
        },
        'assertPublicUrl',
      )
      .mockResolvedValue(undefined);

    fetchSpy.mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (url.endsWith('/robots.txt')) {
        return Promise.resolve(
          jsonResponse(
            'Sitemap: https://www.orion.example/sitemap.xml',
            'text/plain',
          ),
        );
      }

      if (url.endsWith('/sitemap.xml')) {
        return Promise.resolve(
          jsonResponse(
            [
              '<urlset>',
              '<url><loc>https://www.orion.example/healthcare/product/HC866199/efficia-dfm100</loc></url>',
              '<url><loc>https://www.orion.example/product/unrelated-device</loc></url>',
              '</urlset>',
            ].join(''),
            'application/xml',
          ),
        );
      }

      if (url === 'https://www.orion.example/') {
        return Promise.resolve(
          jsonResponse('<html><title>Orion</title></html>', 'text/html'),
        );
      }

      return Promise.resolve(jsonResponse('', 'application/xml', 404));
    });

    const result = await service.discover(identity);

    expect(result.status).toBe('NO_EXACT_CANDIDATE');
    expect(result.candidates).toEqual([]);
  });

  it('classifies an exact dedicated official model page', () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    const result = service.evaluatePage(identity, 'www.orion.example', {
      requestedUrl:
        'https://www.orion.example/products/OX900_15/precision-trimmer',
      finalUrl: 'https://www.orion.example/products/OX900_15/precision-trimmer',
      canonicalUrl:
        'https://www.orion.example/products/OX900_15/precision-trimmer',
      title: 'Orion Precision Trimmer OX900/15',
      heading: 'Precision Trimmer OX900/15',
      description: 'Official Orion product page.',
      text: 'Orion OX900/15 precision trimmer specifications.',
      imageUrl: 'https://cdn.orion.example/OX900_15.png',
      jsonLdProducts: [
        {
          '@type': 'Product',
          name: 'Orion Precision Trimmer OX900/15',
          model: 'OX900/15',
          mpn: 'OX900/15',
          url: 'https://www.orion.example/products/OX900_15/precision-trimmer',
        },
      ],
    });

    expect(result.classification).toBe('EXACT_OFFICIAL_PRODUCT_PAGE');
    expect(result.exactMatch).toBe(true);
    expect(result.officialDomainMatch).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.matchedIdentifiers).toContain('OX900/15');
  });

  it('rejects an official category page as a canonical product page', () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    const result = service.evaluatePage(identity, 'www.orion.example', {
      requestedUrl: 'https://www.orion.example/products/trimmers',
      finalUrl: 'https://www.orion.example/products/trimmers',
      canonicalUrl: 'https://www.orion.example/products/trimmers',
      title: 'All Orion Trimmers',
      heading: 'Trimmers',
      description: 'Browse the complete product family.',
      text: 'OX800/10 OX900/15 OX950/20 and other models.',
      imageUrl: null,
      jsonLdProducts: [],
    });

    expect(result.classification).toBe('OFFICIAL_PRODUCT_FAMILY_PAGE');
    expect(result.exactMatch).toBe(false);
    expect(result.canonicalUrl).toBeNull();
  });

  it('rejects a different model on the official domain', () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    const result = service.evaluatePage(identity, 'www.orion.example', {
      requestedUrl: 'https://www.orion.example/products/OX800_10',
      finalUrl: 'https://www.orion.example/products/OX800_10',
      canonicalUrl: 'https://www.orion.example/products/OX800_10',
      title: 'Orion Precision Trimmer OX800/10',
      heading: 'OX800/10',
      description: null,
      text: 'Official product page for OX800/10.',
      imageUrl: null,
      jsonLdProducts: [
        {
          '@type': 'Product',
          model: 'OX800/10',
          mpn: 'OX800/10',
        },
      ],
    });

    expect(result.classification).toBe('OFFICIAL_WRONG_MODEL');
    expect(result.exactMatch).toBe(false);
  });

  it('rejects a matching model hosted on a marketplace domain', () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );

    const result = service.evaluatePage(identity, 'www.orion.example', {
      requestedUrl: 'https://market.example/OX900_15',
      finalUrl: 'https://market.example/OX900_15',
      canonicalUrl: 'https://market.example/OX900_15',
      title: 'Orion OX900/15',
      heading: 'Orion OX900/15',
      description: null,
      text: 'Orion OX900/15',
      imageUrl: null,
      jsonLdProducts: [
        {
          '@type': 'Product',
          model: 'OX900/15',
        },
      ],
    });

    expect(result.classification).toBe('UNVERIFIED_DOMAIN');
    expect(result.exactMatch).toBe(false);
  });

  it('matches slash, underscore, and hyphen aliases without brand-specific rules', () => {
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      createProvider(),
    );
    const secondIdentity = {
      ...identity,
      brandName: 'Aster',
      brandWebsite: 'https://aster.example',
      productName: 'Aster Dryer Pro',
      productModelName: 'AD-550/02',
      productModelCode: 'AD-550/02',
      variantIdentifiers: ['AD-550/02'],
    };

    const result = service.evaluatePage(secondIdentity, 'aster.example', {
      requestedUrl: 'https://aster.example/p/AD_550_02',
      finalUrl: 'https://aster.example/p/AD_550_02',
      canonicalUrl: 'https://aster.example/p/AD_550_02',
      title: 'Aster Dryer Pro AD-550/02',
      heading: 'AD-550/02',
      description: null,
      text: 'Official model AD-550/02.',
      imageUrl: null,
      jsonLdProducts: [
        {
          '@type': 'Product',
          model: 'AD-550/02',
        },
      ],
    });

    expect(result.classification).toBe('EXACT_OFFICIAL_PRODUCT_PAGE');
    expect(result.exactMatch).toBe(true);
  });

  it('ignores AI aliases that do not preserve a supplied identifier', async () => {
    const provider: AiProvider = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          aliases: ['COMPLETELY-DIFFERENT-1000', 'https://fake.example/item'],
          searchQueries: ['unrelated product'],
          officialDomainCandidates: [],
        }),
        model: 'qwen3.5:9b',
      }),
    };
    const service = new OfficialProductPageResolverService(
      createPrisma() as unknown as PrismaService,
      provider,
    );

    jest
      .spyOn(
        service as unknown as {
          assertPublicUrl(url: string): Promise<void>;
        },
        'assertPublicUrl',
      )
      .mockResolvedValue(undefined);

    fetchSpy.mockResolvedValue(
      jsonResponse('<urlset></urlset>', 'application/xml'),
    );

    const result = await service.discover(identity);

    expect(result.aliases).toContain('OX900/15');
    expect(result.aliases).not.toContain('COMPLETELY-DIFFERENT-1000');
    expect(result.aliases.some((item) => item.includes('fake.example'))).toBe(
      false,
    );
  });
});
