import type { PrismaService } from '../../../core/prisma/prisma.service';

import { CatalogWebResearchService } from './catalog-web-research.service';
import type {
  OfficialProductIdentity,
  OfficialProductPageEvaluation,
  OfficialProductPageResolverService,
} from './official-product-page-resolver.service';

type ResearchCandidateInput = {
  url: string;
  sourceType: string;
  isOfficial: boolean;
  declaredByAdmin: boolean;
  officialHostname: string | null;
  discoveryMethod: string | null;
  discoveryScore: number | null;
  aliases: string[];
};

type ExtractedPageFixture = {
  title: string | null;
  heading: string | null;
  description: string | null;
  language: string | null;
  canonicalUrl: string | null;
  imageUrl: string | null;
  text: string;
  links: Array<{ url: string; text: string }>;
  jsonLdProducts: Array<Record<string, unknown>>;
};

type IngestResultFixture = {
  sourceId: string | null;
  suggestionsCreated: number;
  suggestionsUpdated: number;
  discoveredCandidates: ResearchCandidateInput[];
  rejection: {
    url: string;
    classification: OfficialProductPageEvaluation['classification'];
    reasons: string[];
  } | null;
};

type CatalogWebResearchInternals = {
  fetchTrustedUrl(url: string): Promise<{
    requestedUrl: string;
    finalUrl: string;
    status: number;
    contentType: string;
    body: string;
  }>;
  extractPage(html: string, finalUrl: string): ExtractedPageFixture;
  ingestCandidate(
    researchRunId: string,
    productId: string,
    identity: OfficialProductIdentity,
    candidate: ResearchCandidateInput,
  ): Promise<IngestResultFixture>;
};

const identity: OfficialProductIdentity = {
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
  variantIdentifiers: ['OX900/15'],
};

const fetchedPage = {
  requestedUrl: 'https://www.orion.example/product/unrelated-device',
  finalUrl: 'https://www.orion.example/product/unrelated-device',
  status: 200,
  contentType: 'text/html',
  body: '<html>usable unrelated page</html>',
};

const extractedPage: ExtractedPageFixture = {
  title: 'Unrelated Orion device',
  heading: 'Unrelated device',
  description: 'A different Orion product.',
  language: 'en',
  canonicalUrl: fetchedPage.finalUrl,
  imageUrl: null,
  text: 'A different Orion product with enough content for evaluation.'.repeat(
    2,
  ),
  links: [],
  jsonLdProducts: [],
};

const relatedEvaluation: OfficialProductPageEvaluation = {
  classification: 'OFFICIAL_RELATED_PAGE',
  exactMatch: false,
  officialDomainMatch: true,
  confidence: 0.45,
  canonicalUrl: null,
  imageUrl: null,
  matchedIdentifiers: [],
  matchedSurfaces: [],
  reasons: ['The official page lacks an exact product identity match.'],
};

describe('CatalogWebResearchService automatic source precision', () => {
  const createService = () => {
    const prisma = {
      catalogResearchSource: {
        upsert: jest.fn().mockResolvedValue({ id: 'source-1' }),
      },
    };
    const resolver = {
      evaluatePage: jest.fn().mockReturnValue(relatedEvaluation),
    };
    const service = new CatalogWebResearchService(
      prisma as unknown as PrismaService,
      resolver as unknown as OfficialProductPageResolverService,
    );
    const internals = service as unknown as CatalogWebResearchInternals;

    jest.spyOn(internals, 'fetchTrustedUrl').mockResolvedValue(fetchedPage);
    jest.spyOn(internals, 'extractPage').mockReturnValue(extractedPage);

    return { prisma, internals };
  };

  it('does not persist an automatically discovered non-exact official page', async () => {
    const { prisma, internals } = createService();

    const result = await internals.ingestCandidate(
      'run-1',
      identity.productId,
      identity,
      {
        url: fetchedPage.requestedUrl,
        sourceType: 'PRODUCT_OFFICIAL_DISCOVERED',
        isOfficial: true,
        declaredByAdmin: false,
        officialHostname: 'www.orion.example',
        discoveryMethod: 'OFFICIAL_SITEMAP',
        discoveryScore: 8,
        aliases: ['OX900/15'],
      },
    );

    expect(result.sourceId).toBeNull();
    expect(result.rejection).toMatchObject({
      url: fetchedPage.finalUrl,
      classification: 'OFFICIAL_RELATED_PAGE',
    });
    expect(prisma.catalogResearchSource.upsert).not.toHaveBeenCalled();
  });

  it('preserves the explicit admin-source workflow for reviewable evidence', async () => {
    const { prisma, internals } = createService();

    const result = await internals.ingestCandidate(
      'run-1',
      identity.productId,
      identity,
      {
        url: fetchedPage.requestedUrl,
        sourceType: 'MANUAL_SOURCE',
        isOfficial: false,
        declaredByAdmin: true,
        officialHostname: null,
        discoveryMethod: 'ADMIN_MANUAL_SOURCE',
        discoveryScore: null,
        aliases: [],
      },
    );

    expect(result.sourceId).toBe('source-1');
    expect(result.rejection).toBeNull();
    expect(prisma.catalogResearchSource.upsert).toHaveBeenCalledTimes(1);
  });
});
