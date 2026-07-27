import { Inject, Injectable, Logger } from '@nestjs/common';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { QueueExecutionCancellationUtil } from '../../../core/queue/utils/queue-execution-cancellation.util';

import { AI_PROVIDER } from '../constants/ai-provider.tokens';
import { AiProvider } from '../interfaces/ai-provider.interface';

export type OfficialProductPageClassification =
  | 'EXACT_OFFICIAL_PRODUCT_PAGE'
  | 'OFFICIAL_PRODUCT_FAMILY_PAGE'
  | 'OFFICIAL_RELATED_PAGE'
  | 'OFFICIAL_WRONG_MODEL'
  | 'UNVERIFIED_DOMAIN'
  | 'INSUFFICIENT_IDENTITY';

export type OfficialProductIdentity = {
  productId: string;
  productName: string;
  productSku: string;
  canonicalUrl: string | null;
  brandId: string;
  brandName: string | null;
  brandWebsite: string | null;
  productModelId: string | null;
  productModelName: string | null;
  productModelCode: string | null;
  variantIdentifiers: string[];
};

export type OfficialProductDiscoveryCandidate = {
  url: string;
  officialHostname: string;
  sourceType: 'PRODUCT_OFFICIAL_DISCOVERED';
  discoveryMethod:
    'OFFICIAL_SITEMAP' | 'OFFICIAL_INTERNAL_LINK' | 'CONFIGURED_WEB_SEARCH';
  aliases: string[];
  score: number;
};

export type OfficialProductDiscoveryResult = {
  status:
    | 'CANDIDATES_DISCOVERED'
    | 'NO_OFFICIAL_DOMAIN'
    | 'INSUFFICIENT_IDENTITY'
    | 'NO_EXACT_CANDIDATE';
  aliases: string[];
  searchQueries: string[];
  officialHostnames: string[];
  candidates: OfficialProductDiscoveryCandidate[];
  aiModel: string | null;
  aiRunLogId: string | null;
  errors: Array<{
    target: string;
    error: string;
  }>;
};

export type OfficialProductPageDocument = {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string | null;
  title: string | null;
  heading: string | null;
  description: string | null;
  text: string;
  imageUrl: string | null;
  jsonLdProducts: Array<Record<string, unknown>>;
};

export type OfficialProductPageEvaluation = {
  classification: OfficialProductPageClassification;
  exactMatch: boolean;
  officialDomainMatch: boolean;
  confidence: number;
  canonicalUrl: string | null;
  imageUrl: string | null;
  matchedIdentifiers: string[];
  matchedSurfaces: string[];
  reasons: string[];
};

type AliasPlan = {
  aliases: string[];
  searchQueries: string[];
  officialDomainCandidates: string[];
  aiModel: string | null;
  aiRunLogId: string | null;
};

type OfficialRoot = {
  origin: string;
  hostname: string;
  verification:
    'BRAND_WEBSITE' | 'APPROVED_OFFICIAL_SOURCE' | 'AI_VERIFIED_BRAND_DOMAIN';
};

type FetchTextResult = {
  finalUrl: string;
  contentType: string;
  body: string;
};

type RankedUrl = {
  url: string;
  score: number;
  method: OfficialProductDiscoveryCandidate['discoveryMethod'];
};

const USER_AGENT =
  'VEXO-Official-Product-Resolver/1.0 (+https://vexobeauty.ir)';
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DISCOVERY_BUDGET_MS = 90_000;
const MAX_OFFICIAL_ROOTS = 5;
const MAX_SITEMAP_DOCUMENTS = 24;
const MAX_SITEMAP_URLS = 25_000;
const MAX_DISCOVERY_CANDIDATES = 12;
const MAX_AI_ALIASES = 18;
const MAX_AI_QUERIES = 10;
const MAX_AI_DOMAIN_CANDIDATES = 8;

const FAMILY_MARKERS = [
  'category',
  'categories',
  'catalog',
  'collection',
  'collections',
  'family',
  'families',
  'products',
  'product range',
  'search',
  'shop',
  'all products',
  'دسته',
  'محصولات',
  'خانواده',
];

const MARKETPLACE_HOST_MARKERS = [
  'amazon.',
  'ebay.',
  'aliexpress.',
  'walmart.',
  'digikala.',
  'torob.',
  'basalam.',
  'khanoumi.',
];

@Injectable()
export class OfficialProductPageResolverService {
  private readonly logger = new Logger(OfficialProductPageResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
  ) {}

  async discover(
    identity: OfficialProductIdentity,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<OfficialProductDiscoveryResult> {
    const { signal } = options;

    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const deterministicAliases = this.buildDeterministicAliases(identity);

    if (deterministicAliases.length === 0) {
      return {
        status: 'INSUFFICIENT_IDENTITY',
        aliases: [],
        searchQueries: [],
        officialHostnames: [],
        candidates: [],
        aiModel: null,
        aiRunLogId: null,
        errors: [],
      };
    }

    const plan = await this.buildAliasPlan(
      identity,
      deterministicAliases,
      signal,
    );
    const roots = await this.resolveOfficialRoots(identity, plan, signal);

    if (roots.length === 0) {
      return {
        status: 'NO_OFFICIAL_DOMAIN',
        aliases: plan.aliases,
        searchQueries: plan.searchQueries,
        officialHostnames: [],
        candidates: [],
        aiModel: plan.aiModel,
        aiRunLogId: plan.aiRunLogId,
        errors: [],
      };
    }

    const deadline = Date.now() + DISCOVERY_BUDGET_MS;
    const ranked = new Map<string, RankedUrl>();
    const errors: Array<{ target: string; error: string }> = [];

    for (const root of roots.slice(0, MAX_OFFICIAL_ROOTS)) {
      if (Date.now() >= deadline) {
        break;
      }

      try {
        const discovered = await this.discoverOnOfficialRoot(
          root,
          plan,
          deadline,
          signal,
        );

        for (const item of discovered) {
          const normalized = this.normalizeHttpUrl(item.url);
          const previous = ranked.get(normalized);

          if (!previous || previous.score < item.score) {
            ranked.set(normalized, item);
          }
        }
      } catch (error) {
        if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
          throw error;
        }

        errors.push({
          target: root.origin,
          error: this.errorMessage(error),
        });
      }
    }

    const candidates = [...ranked.values()]
      .sort((first, second) => second.score - first.score)
      .slice(0, MAX_DISCOVERY_CANDIDATES)
      .map((item) => ({
        url: item.url,
        officialHostname: new URL(item.url).hostname,
        sourceType: 'PRODUCT_OFFICIAL_DISCOVERED' as const,
        discoveryMethod: item.method,
        aliases: plan.aliases,
        score: item.score,
      }));

    return {
      status:
        candidates.length > 0 ? 'CANDIDATES_DISCOVERED' : 'NO_EXACT_CANDIDATE',
      aliases: plan.aliases,
      searchQueries: plan.searchQueries,
      officialHostnames: roots.map((item) => item.hostname),
      candidates,
      aiModel: plan.aiModel,
      aiRunLogId: plan.aiRunLogId,
      errors,
    };
  }

  evaluatePage(
    identity: OfficialProductIdentity,
    officialHostname: string | null,
    document: OfficialProductPageDocument,
  ): OfficialProductPageEvaluation {
    const strongIdentifiers = this.buildStrongIdentifiers(identity);

    if (strongIdentifiers.length === 0) {
      return this.evaluation(
        'INSUFFICIENT_IDENTITY',
        false,
        false,
        0,
        null,
        null,
        [],
        [],
        ['No manufacturer model, MPN, GTIN, or barcode is available.'],
      );
    }

    const finalHostname = this.hostname(document.finalUrl);
    const canonicalHostname = this.hostname(document.canonicalUrl);
    const officialDomainMatch = Boolean(
      officialHostname &&
      (this.sameHostname(officialHostname, finalHostname) ||
        this.sameHostname(officialHostname, canonicalHostname)),
    );

    if (!officialHostname || !officialDomainMatch) {
      return this.evaluation(
        'UNVERIFIED_DOMAIN',
        false,
        false,
        0,
        null,
        null,
        [],
        [],
        ['The page is not hosted on the verified official brand domain.'],
      );
    }

    const urlSurface = this.compact(
      [document.finalUrl, document.canonicalUrl].filter(Boolean).join(' '),
    );
    const titleSurface = this.compact(
      [document.title, document.heading, document.description]
        .filter(Boolean)
        .join(' '),
    );
    const structuredSurface = this.compact(
      document.jsonLdProducts
        .flatMap((item) => this.productStructuredStrings(item))
        .join(' '),
    );
    const bodySurface = this.compact(document.text.slice(0, 120_000));

    const matchedIdentifiers: string[] = [];
    const matchedSurfaces = new Set<string>();
    let strongestMatch = 0;

    for (const identifier of strongIdentifiers) {
      const surfaces = [
        ['URL_OR_CANONICAL', urlSurface],
        ['TITLE_OR_HEADING', titleSurface],
        ['STRUCTURED_PRODUCT_DATA', structuredSurface],
        ['VISIBLE_PAGE_TEXT', bodySurface],
      ] as const;
      const matches = surfaces
        .filter(([, surface]) => surface.includes(identifier.compact))
        .map(([name]) => name);

      if (matches.length === 0) {
        continue;
      }

      matchedIdentifiers.push(identifier.raw);
      matches.forEach((surface) => matchedSurfaces.add(surface));

      const weight =
        identifier.kind === 'GTIN' || identifier.kind === 'BARCODE'
          ? 5
          : identifier.kind === 'MPN'
            ? 4
            : 3;
      const surfaceBonus = matches.includes('STRUCTURED_PRODUCT_DATA')
        ? 4
        : matches.includes('URL_OR_CANONICAL')
          ? 3
          : matches.includes('TITLE_OR_HEADING')
            ? 2
            : 1;

      strongestMatch = Math.max(
        strongestMatch,
        weight + surfaceBonus + Math.min(3, matches.length),
      );
    }

    const hasProductNode = document.jsonLdProducts.length > 0;
    const urlMatch = matchedSurfaces.has('URL_OR_CANONICAL');
    const titleMatch = matchedSurfaces.has('TITLE_OR_HEADING');
    const structuredMatch = matchedSurfaces.has('STRUCTURED_PRODUCT_DATA');
    const dedicatedPage =
      structuredMatch ||
      (urlMatch && titleMatch) ||
      (urlMatch && hasProductNode);
    const wrongModel = this.containsCompetingModelCode(
      identity,
      document,
      strongIdentifiers.map((item) => item.compact),
    );

    if (wrongModel) {
      return this.evaluation(
        'OFFICIAL_WRONG_MODEL',
        false,
        true,
        0.2,
        null,
        null,
        matchedIdentifiers,
        [...matchedSurfaces],
        ['The official page appears to describe a different model.'],
      );
    }

    const familyPage = this.looksLikeFamilyPage(document) && !dedicatedPage;

    if (familyPage) {
      return this.evaluation(
        'OFFICIAL_PRODUCT_FAMILY_PAGE',
        false,
        true,
        0.35,
        null,
        null,
        matchedIdentifiers,
        [...matchedSurfaces],
        ['The page is an official category or family page, not a model page.'],
      );
    }

    const exactMatch =
      matchedIdentifiers.length > 0 &&
      dedicatedPage &&
      (structuredMatch || urlMatch || strongestMatch >= 8);

    if (!exactMatch) {
      return this.evaluation(
        'OFFICIAL_RELATED_PAGE',
        false,
        true,
        0.45,
        null,
        null,
        matchedIdentifiers,
        [...matchedSurfaces],
        [
          'The official page is related but lacks an exact product identity match.',
        ],
      );
    }

    const canonicalUrl = this.resolveVerifiedCanonicalUrl(
      officialHostname,
      document,
    );
    const confidence = this.clamp01(
      0.84 +
        (structuredMatch ? 0.07 : 0) +
        (urlMatch ? 0.04 : 0) +
        (titleMatch ? 0.03 : 0) +
        Math.min(0.02, matchedIdentifiers.length * 0.01),
    );

    return this.evaluation(
      'EXACT_OFFICIAL_PRODUCT_PAGE',
      true,
      true,
      confidence,
      canonicalUrl,
      document.imageUrl,
      matchedIdentifiers,
      [...matchedSurfaces],
      [
        'Verified official brand domain.',
        'Exact manufacturer identifier matched on a dedicated product page.',
      ],
    );
  }

  private async buildAliasPlan(
    identity: OfficialProductIdentity,
    deterministicAliases: string[],
    signal?: AbortSignal,
  ): Promise<AliasPlan> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const deterministicQueries = this.buildDeterministicQueries(
      identity,
      deterministicAliases,
    );

    try {
      const result = await this.aiProvider.generate(
        [
          {
            role: 'system',
            content: [
              'You plan web discovery for exact official manufacturer product pages.',
              'Generate aliases and search queries only; never invent a final product URL.',
              'Aliases must preserve the supplied model or manufacturer identifiers.',
              'Domain candidates are only hypotheses and will be independently verified.',
              'Return JSON only.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'OFFICIAL_PRODUCT_PAGE_DISCOVERY_PLAN',
              product: {
                productName: identity.productName,
                brandName: identity.brandName,
                modelName: identity.productModelName,
                modelCode: identity.productModelCode,
                identifiers: identity.variantIdentifiers,
              },
              deterministicAliases,
              rules: {
                maximumAliases: MAX_AI_ALIASES,
                maximumSearchQueries: MAX_AI_QUERIES,
                maximumDomainCandidates: MAX_AI_DOMAIN_CANDIDATES,
                noFinalUrlGuessing: true,
              },
            }),
          },
        ],
        {
          task: 'CONSULTING',
          temperature: 0.1,
          maxTokens: 700,
          jsonSchema: this.aliasPlanSchema(),
          promptKey: 'catalog-official-product-discovery-plan',
          signal,
          metadata: {
            productId: identity.productId,
            brandId: identity.brandId,
          },
        },
      );
      const parsed = this.toRecord(JSON.parse(result.content));
      const aiAliases = this.safeStringArray(parsed.aliases, MAX_AI_ALIASES)
        .filter((item) => !this.looksLikeUrl(item))
        .filter((item) =>
          this.aliasPreservesIdentity(item, deterministicAliases),
        );
      const searchQueries = this.safeStringArray(
        parsed.searchQueries,
        MAX_AI_QUERIES,
      ).filter((item) => !this.looksLikeUrl(item));
      const domainCandidates = this.safeStringArray(
        parsed.officialDomainCandidates,
        MAX_AI_DOMAIN_CANDIDATES,
      )
        .map((item) => this.normalizeHostnameCandidate(item))
        .filter((item): item is string => Boolean(item));

      return {
        aliases: this.uniqueStrings([
          ...deterministicAliases,
          ...aiAliases,
        ]).slice(0, MAX_AI_ALIASES),
        searchQueries: this.uniqueStrings([
          ...deterministicQueries,
          ...searchQueries,
        ]).slice(0, MAX_AI_QUERIES),
        officialDomainCandidates: this.uniqueStrings(domainCandidates).slice(
          0,
          MAX_AI_DOMAIN_CANDIDATES,
        ),
        aiModel: result.model,
        aiRunLogId: result.runLogId ?? null,
      };
    } catch (error) {
      if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
        throw error;
      }

      this.logger.warn(
        `Official product discovery planner fell back to deterministic aliases: ${this.errorMessage(error)}`,
      );

      return {
        aliases: deterministicAliases,
        searchQueries: deterministicQueries,
        officialDomainCandidates: [],
        aiModel: null,
        aiRunLogId: null,
      };
    }
  }

  private aliasPlanSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['aliases', 'searchQueries', 'officialDomainCandidates'],
      properties: {
        aliases: {
          type: 'array',
          maxItems: MAX_AI_ALIASES,
          items: {
            type: 'string',
            maxLength: 160,
          },
        },
        searchQueries: {
          type: 'array',
          maxItems: MAX_AI_QUERIES,
          items: {
            type: 'string',
            maxLength: 300,
          },
        },
        officialDomainCandidates: {
          type: 'array',
          maxItems: MAX_AI_DOMAIN_CANDIDATES,
          items: {
            type: 'string',
            maxLength: 160,
          },
        },
      },
    };
  }

  private async resolveOfficialRoots(
    identity: OfficialProductIdentity,
    plan: AliasPlan,
    signal?: AbortSignal,
  ): Promise<OfficialRoot[]> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const roots: OfficialRoot[] = [];
    const add = (
      rawUrl: string | null | undefined,
      verification: OfficialRoot['verification'],
    ) => {
      const origin = this.safeOrigin(rawUrl);

      if (!origin || this.isVexoDomain(origin)) {
        return;
      }

      const hostname = new URL(origin).hostname;

      if (
        roots.some((item) => this.sameHostname(item.hostname, hostname)) ||
        this.isMarketplaceHostname(hostname)
      ) {
        return;
      }

      roots.push({
        origin,
        hostname,
        verification,
      });
    };

    add(identity.brandWebsite, 'BRAND_WEBSITE');

    const [sources, approved] = await Promise.all([
      this.prisma.catalogResearchSource.findMany({
        where: {
          isOfficial: true,
          deletedAt: null,
          researchRun: {
            brandId: identity.brandId,
            deletedAt: null,
          },
        },
        select: {
          sourceUrl: true,
          canonicalUrl: true,
          domain: true,
        },
        orderBy: {
          trustScore: 'desc',
        },
        take: 40,
      }),
      this.prisma.catalogApprovedKnowledge.findMany({
        where: {
          brandId: identity.brandId,
          isCurrent: true,
          deletedAt: null,
        },
        select: {
          sourceUrlsJson: true,
          metadataJson: true,
        },
        orderBy: {
          confidence: 'desc',
        },
        take: 40,
      }),
    ]);

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    for (const source of sources) {
      add(source.canonicalUrl, 'APPROVED_OFFICIAL_SOURCE');
      add(source.sourceUrl, 'APPROVED_OFFICIAL_SOURCE');
      add(source.domain, 'APPROVED_OFFICIAL_SOURCE');
    }

    for (const item of approved) {
      const metadata = this.toRecord(item.metadataJson);
      const verification = this.stringValue(metadata.sourceVerification);

      if (
        !verification ||
        ![
          'EXACT_OFFICIAL_PRODUCT_PAGE',
          'OFFICIAL_DOMAIN_MATCH',
          'ADMIN_DECLARED_OFFICIAL',
        ].includes(verification)
      ) {
        continue;
      }

      for (const url of this.safeStringArray(item.sourceUrlsJson, 12)) {
        add(url, 'APPROVED_OFFICIAL_SOURCE');
      }
    }

    for (const hostname of plan.officialDomainCandidates) {
      if (roots.length >= MAX_OFFICIAL_ROOTS) {
        break;
      }

      try {
        QueueExecutionCancellationUtil.throwIfAborted(signal);
        const verified = await this.verifyAiDomainCandidate(
          identity,
          hostname,
          signal,
        );

        if (verified) {
          add(`https://${hostname}`, 'AI_VERIFIED_BRAND_DOMAIN');
        }
      } catch {
        if (signal?.aborted) {
          QueueExecutionCancellationUtil.throwIfAborted(signal);
        }

        continue;
      }
    }

    return roots.slice(0, MAX_OFFICIAL_ROOTS);
  }

  private async verifyAiDomainCandidate(
    identity: OfficialProductIdentity,
    hostname: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    if (this.isMarketplaceHostname(hostname)) {
      return false;
    }

    const result = await this.fetchText(
      `https://${hostname}/`,
      ['text/html', 'application/xhtml+xml'],
      signal,
    );
    const html = result.body;
    const title = this.matchMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const siteName = this.matchMeta(
      html,
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    );
    const organizationNames = this.extractOrganizationNames(html);
    const brandAliases = this.brandAliases(identity);
    const signals = [title, siteName, ...organizationNames]
      .filter((item): item is string => Boolean(item))
      .map((item) => this.compact(item));
    const matchingSignals = signals.filter((signal) =>
      brandAliases.some((alias) => signal.includes(this.compact(alias))),
    );
    const hostnameCompact = this.compact(hostname.split('.')[0] ?? hostname);
    const hostnameMatches = brandAliases.some((alias) =>
      hostnameCompact.includes(this.compact(alias)),
    );

    return (
      matchingSignals.length >= 2 ||
      (matchingSignals.length >= 1 && hostnameMatches)
    );
  }

  private async discoverOnOfficialRoot(
    root: OfficialRoot,
    plan: AliasPlan,
    deadline: number,
    signal?: AbortSignal,
  ): Promise<RankedUrl[]> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const ranked = new Map<string, RankedUrl>();
    const add = (rawUrl: string, method: RankedUrl['method'], bonus = 0) => {
      if (Date.now() >= deadline) {
        return;
      }

      const normalized = this.safeHttpUrl(rawUrl);

      if (!normalized) {
        return;
      }

      const url = new URL(normalized);

      if (
        !this.sameHostname(root.hostname, url.hostname) ||
        this.isAssetPath(url.pathname) ||
        url.pathname === '/'
      ) {
        return;
      }

      const identityScore = this.scoreCandidateUrl(normalized, plan.aliases);

      if (identityScore <= 0) {
        return;
      }

      const score = identityScore + bonus;

      if (score < 8) {
        return;
      }

      const previous = ranked.get(normalized);

      if (!previous || previous.score < score) {
        ranked.set(normalized, {
          url: normalized,
          score,
          method,
        });
      }
    };

    const sitemapSeeds = new Set<string>([
      new URL('/sitemap.xml', root.origin).toString(),
      new URL('/sitemap_index.xml', root.origin).toString(),
      new URL('/sitemap-index.xml', root.origin).toString(),
    ]);

    try {
      const robots = await this.fetchText(
        new URL('/robots.txt', root.origin).toString(),
        ['text/plain', 'text/html'],
        signal,
      );

      for (const sitemap of this.extractRobotsSitemaps(robots.body)) {
        sitemapSeeds.add(sitemap);
      }
    } catch (error) {
      if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
        throw error;
      }

      // Default sitemap locations remain available.
    }

    const sitemapQueue = [...sitemapSeeds];
    const visitedSitemaps = new Set<string>();
    let observedUrls = 0;

    while (
      sitemapQueue.length > 0 &&
      visitedSitemaps.size < MAX_SITEMAP_DOCUMENTS &&
      observedUrls < MAX_SITEMAP_URLS &&
      Date.now() < deadline
    ) {
      QueueExecutionCancellationUtil.throwIfAborted(signal);
      const sitemapUrl = sitemapQueue.shift();

      if (!sitemapUrl) {
        break;
      }

      const normalizedSitemap = this.safeHttpUrl(sitemapUrl);

      if (
        !normalizedSitemap ||
        visitedSitemaps.has(normalizedSitemap) ||
        !this.sameHostname(root.hostname, new URL(normalizedSitemap).hostname)
      ) {
        continue;
      }

      visitedSitemaps.add(normalizedSitemap);

      try {
        const sitemap = await this.fetchText(
          normalizedSitemap,
          [
            'application/xml',
            'text/xml',
            'text/plain',
            'application/xhtml+xml',
          ],
          signal,
        );
        const locations = this.extractXmlLocations(sitemap.body);

        for (const location of locations) {
          if (observedUrls >= MAX_SITEMAP_URLS || Date.now() >= deadline) {
            break;
          }

          if (/\.xml(?:\.gz)?(?:$|\?)/i.test(location)) {
            sitemapQueue.push(location);
            continue;
          }

          observedUrls += 1;
          add(location, 'OFFICIAL_SITEMAP', 4);
        }
      } catch (error) {
        if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
          throw error;
        }

        continue;
      }
    }

    if (Date.now() < deadline) {
      try {
        const homepage = await this.fetchText(
          root.origin,
          ['text/html', 'application/xhtml+xml'],
          signal,
        );

        for (const link of this.extractLinks(
          homepage.body,
          homepage.finalUrl,
        )) {
          add(link, 'OFFICIAL_INTERNAL_LINK', 1);
        }
      } catch (error) {
        if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
          throw error;
        }

        // Sitemap discovery remains authoritative.
      }
    }

    if (Date.now() < deadline) {
      for (const item of await this.searchConfiguredProvider(
        root,
        plan,
        signal,
      )) {
        add(item, 'CONFIGURED_WEB_SEARCH', 6);
      }
    }

    return [...ranked.values()]
      .sort((first, second) => second.score - first.score)
      .slice(0, MAX_DISCOVERY_CANDIDATES);
  }

  private async searchConfiguredProvider(
    root: OfficialRoot,
    plan: AliasPlan,
    signal?: AbortSignal,
  ): Promise<string[]> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const endpoint = process.env.CATALOG_WEB_SEARCH_ENDPOINT?.trim();

    if (!endpoint) {
      return [];
    }

    const results: string[] = [];

    for (const query of plan.searchQueries.slice(0, 4)) {
      const scopedQuery = `site:${root.hostname} ${query}`;
      const url = endpoint.includes('{query}')
        ? endpoint.replace('{query}', encodeURIComponent(scopedQuery))
        : this.appendSearchQuery(endpoint, scopedQuery);
      const linked = QueueExecutionCancellationUtil.createLinkedTimeoutSignal(
        signal,
        REQUEST_TIMEOUT_MS,
      );

      try {
        await this.assertPublicUrl(url);
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        };
        const apiKey = process.env.CATALOG_WEB_SEARCH_API_KEY?.trim();

        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
          headers['X-API-Key'] = apiKey;
        }

        const response = await fetch(url, {
          method: 'GET',
          signal: linked.signal,
          headers,
        });

        if (!response.ok) {
          continue;
        }

        const payload: unknown = await response.json();

        for (const resultUrl of this.extractSearchResultUrls(payload)) {
          if (
            this.sameHostname(root.hostname, this.hostname(resultUrl)) &&
            !results.includes(resultUrl)
          ) {
            results.push(resultUrl);
          }
        }
      } catch {
        if (signal?.aborted) {
          QueueExecutionCancellationUtil.throwIfAborted(signal);
        }

        continue;
      } finally {
        linked.cleanup();
      }
    }

    return results.slice(0, 20);
  }

  private extractSearchResultUrls(value: unknown): string[] {
    const root = this.toRecord(value);
    const candidates: unknown[] = [];

    if (Array.isArray(root.results)) {
      for (const item of root.results as unknown[]) {
        candidates.push(item);
      }
    }

    if (Array.isArray(root.items)) {
      for (const item of root.items as unknown[]) {
        candidates.push(item);
      }
    }

    const webPages = this.toRecord(root.webPages);

    if (Array.isArray(webPages.value)) {
      for (const item of webPages.value as unknown[]) {
        candidates.push(item);
      }
    }

    return candidates
      .map((item) => {
        const record = this.toRecord(item);

        return this.stringValue(record.url) ?? this.stringValue(record.link);
      })
      .filter((item): item is string => Boolean(item))
      .map((item) => this.safeHttpUrl(item))
      .filter((item): item is string => Boolean(item));
  }

  private buildDeterministicAliases(
    identity: OfficialProductIdentity,
  ): string[] {
    const values = [
      identity.productModelCode,
      identity.productModelName,
      ...identity.variantIdentifiers.filter(
        (item) => !/^vexo[-_]/i.test(item.trim()),
      ),
    ];
    const aliases: string[] = [];

    for (const value of values) {
      if (!value?.trim()) {
        continue;
      }

      const normalized = value.normalize('NFKC').trim();
      const compact = this.compact(normalized);

      if (
        !this.looksLikeManufacturerIdentifier(normalized) ||
        compact.length < 4
      ) {
        continue;
      }

      aliases.push(normalized, compact);

      const punctuationVariants = [
        normalized.replace(/[\s/_]+/g, '-'),
        normalized.replace(/[\s/-]+/g, '_'),
        normalized.replace(/[\s_-]+/g, '/'),
        normalized.replace(/[^\p{L}\p{N}]+/gu, ''),
      ];

      aliases.push(...punctuationVariants);

      const base = normalized.split(/[/_-]/)[0]?.trim();

      if (base && this.compact(base).length >= 5) {
        aliases.push(base);
      }
    }

    return this.uniqueStrings(aliases)
      .filter((item) => item.length >= 4)
      .slice(0, MAX_AI_ALIASES);
  }

  private buildStrongIdentifiers(identity: OfficialProductIdentity): Array<{
    raw: string;
    compact: string;
    kind: 'MODEL' | 'MPN' | 'GTIN' | 'BARCODE';
  }> {
    const result: Array<{
      raw: string;
      compact: string;
      kind: 'MODEL' | 'MPN' | 'GTIN' | 'BARCODE';
    }> = [];
    const add = (
      raw: string | null | undefined,
      kind: 'MODEL' | 'MPN' | 'GTIN' | 'BARCODE',
    ) => {
      if (!raw?.trim() || /^vexo[-_]/i.test(raw.trim())) {
        return;
      }

      const compact = this.compact(raw);

      if (compact.length < 4 || !this.looksLikeManufacturerIdentifier(raw)) {
        return;
      }

      if (result.some((item) => item.compact === compact)) {
        return;
      }

      result.push({
        raw: raw.trim(),
        compact,
        kind,
      });
    };

    add(identity.productModelCode, 'MODEL');
    add(identity.productModelName, 'MODEL');

    for (const identifier of identity.variantIdentifiers) {
      const digits = identifier.replace(/\D/g, '');
      const kind =
        /^\d{8,14}$/.test(digits) &&
        digits.length === identifier.replace(/\s/g, '').length
          ? 'GTIN'
          : /barcode/i.test(identifier)
            ? 'BARCODE'
            : 'MPN';
      add(identifier, kind);
    }

    return result.slice(0, 30);
  }

  private buildDeterministicQueries(
    identity: OfficialProductIdentity,
    aliases: string[],
  ): string[] {
    const brand = identity.brandName?.trim() ?? '';
    const product = identity.productName.trim();

    return this.uniqueStrings(
      aliases
        .slice(0, 8)
        .flatMap((alias) => [
          [brand, alias].filter(Boolean).join(' '),
          [brand, product, alias].filter(Boolean).join(' '),
        ]),
    )
      .filter(Boolean)
      .slice(0, MAX_AI_QUERIES);
  }

  private scoreCandidateUrl(url: string, aliases: string[]): number {
    const parsed = new URL(url);
    const searchable = this.compact(
      `${parsed.pathname} ${parsed.searchParams.toString()}`,
    );
    let score = 0;

    for (const alias of aliases) {
      const compactAlias = this.compact(alias);

      if (compactAlias.length < 4 || !searchable.includes(compactAlias)) {
        continue;
      }

      score += compactAlias.length >= 8 ? 14 : 10;
    }

    if (this.looksLikeFamilyUrl(parsed)) {
      score -= 6;
    }

    return score;
  }

  private looksLikeFamilyPage(document: OfficialProductPageDocument): boolean {
    const url = new URL(document.finalUrl);
    const searchable = this.normalizeSearchText(
      [url.pathname, document.title, document.heading]
        .filter(Boolean)
        .join(' '),
    );

    return FAMILY_MARKERS.some((marker) =>
      searchable.includes(this.normalizeSearchText(marker)),
    );
  }

  private looksLikeFamilyUrl(url: URL): boolean {
    const searchable = this.normalizeSearchText(url.pathname);

    return FAMILY_MARKERS.some((marker) =>
      searchable.includes(this.normalizeSearchText(marker)),
    );
  }

  private containsCompetingModelCode(
    identity: OfficialProductIdentity,
    document: OfficialProductPageDocument,
    targetCompacts: string[],
  ): boolean {
    const source = [
      document.finalUrl,
      document.canonicalUrl,
      document.title,
      document.heading,
      ...document.jsonLdProducts.flatMap((item) =>
        this.productStructuredStrings(item),
      ),
    ]
      .filter(Boolean)
      .join(' ');
    const codeCandidates =
      source.match(/\b[A-Za-z]{1,6}[-_/]?\d{3,12}(?:[-_/]\d{1,4})?\b/g) ?? [];
    const target = new Set(targetCompacts);

    return (
      codeCandidates.some((item) => {
        const compact = this.compact(item);

        return compact.length >= 4 && !target.has(compact);
      }) &&
      !this.buildStrongIdentifiers(identity).some((item) =>
        this.compact(source).includes(item.compact),
      )
    );
  }

  private productStructuredStrings(product: Record<string, unknown>): string[] {
    const values = [
      product.name,
      product.model,
      product.sku,
      product.mpn,
      product.gtin,
      product.gtin8,
      product.gtin12,
      product.gtin13,
      product.gtin14,
      product.productID,
      product.url,
      product['@id'],
      product.brand,
    ];

    return values
      .map((item) => this.firstString(item))
      .filter((item): item is string => Boolean(item));
  }

  private resolveVerifiedCanonicalUrl(
    officialHostname: string,
    document: OfficialProductPageDocument,
  ): string {
    const canonical = this.safeHttpUrl(document.canonicalUrl);

    if (
      canonical &&
      this.sameHostname(officialHostname, new URL(canonical).hostname)
    ) {
      return canonical;
    }

    return this.normalizeHttpUrl(document.finalUrl);
  }

  private evaluation(
    classification: OfficialProductPageClassification,
    exactMatch: boolean,
    officialDomainMatch: boolean,
    confidence: number,
    canonicalUrl: string | null,
    imageUrl: string | null,
    matchedIdentifiers: string[],
    matchedSurfaces: string[],
    reasons: string[],
  ): OfficialProductPageEvaluation {
    return {
      classification,
      exactMatch,
      officialDomainMatch,
      confidence: Number(this.clamp01(confidence).toFixed(4)),
      canonicalUrl,
      imageUrl,
      matchedIdentifiers: this.uniqueStrings(matchedIdentifiers),
      matchedSurfaces: this.uniqueStrings(matchedSurfaces),
      reasons,
    };
  }

  private extractRobotsSitemaps(body: string): string[] {
    return body
      .split(/\r?\n/)
      .map((line) => /^\s*Sitemap\s*:\s*(\S+)\s*$/i.exec(line)?.[1] ?? null)
      .filter((item): item is string => Boolean(item))
      .map((item) => this.safeHttpUrl(item))
      .filter((item): item is string => Boolean(item));
  }

  private extractXmlLocations(body: string): string[] {
    const locations: string[] = [];

    for (const match of body.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
      const value = this.decodeEntities(match[1] ?? '').trim();
      const url = this.safeHttpUrl(value);

      if (url && !locations.includes(url)) {
        locations.push(url);
      }

      if (locations.length >= MAX_SITEMAP_URLS) {
        break;
      }
    }

    return locations;
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];

    for (const match of html.matchAll(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    )) {
      const raw = match[1]?.trim();

      if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) {
        continue;
      }

      try {
        const url = new URL(raw, baseUrl);

        if (!['http:', 'https:'].includes(url.protocol)) {
          continue;
        }

        url.hash = '';
        const normalized = url.toString();

        if (!links.includes(normalized)) {
          links.push(normalized);
        }
      } catch {
        continue;
      }

      if (links.length >= 1000) {
        break;
      }
    }

    return links;
  }

  private extractOrganizationNames(html: string): string[] {
    const names: string[] = [];

    for (const match of html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )) {
      try {
        const parsed: unknown = JSON.parse(match[1]?.trim() ?? '');
        this.collectOrganizationNames(parsed, names);
      } catch {
        continue;
      }
    }

    return this.uniqueStrings(names).slice(0, 20);
  }

  private collectOrganizationNames(value: unknown, names: string[]): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectOrganizationNames(item, names));
      return;
    }

    const record = this.toRecord(value);

    if (Object.keys(record).length === 0) {
      return;
    }

    const types = Array.isArray(record['@type'])
      ? record['@type']
      : [record['@type']];

    if (
      types.some(
        (item) =>
          typeof item === 'string' &&
          ['organization', 'brand', 'corporation'].includes(item.toLowerCase()),
      )
    ) {
      const name = this.firstString(record.name);

      if (name) {
        names.push(name);
      }
    }

    for (const key of ['@graph', 'mainEntity', 'publisher', 'brand']) {
      if (record[key]) {
        this.collectOrganizationNames(record[key], names);
      }
    }
  }

  private async fetchText(
    initialUrl: string,
    acceptedContentTypes: string[],
    signal?: AbortSignal,
  ): Promise<FetchTextResult> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    let currentUrl = this.normalizeHttpUrl(initialUrl);

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      await this.assertPublicUrl(currentUrl);
      const linked = QueueExecutionCancellationUtil.createLinkedTimeoutSignal(
        signal,
        REQUEST_TIMEOUT_MS,
      );

      try {
        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: linked.signal,
          headers: {
            Accept: acceptedContentTypes.join(','),
            'User-Agent': USER_AGENT,
          },
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');

          if (!location) {
            throw new Error('Redirect response does not include Location.');
          }

          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }

        if (!response.ok) {
          throw new Error(`Official source returned HTTP ${response.status}.`);
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (
          contentType &&
          !acceptedContentTypes.some((item) =>
            contentType.toLowerCase().includes(item.toLowerCase()),
          )
        ) {
          throw new Error(`Unsupported content type: ${contentType}.`);
        }

        const body = await this.readLimitedBody(response);

        return {
          finalUrl: currentUrl,
          contentType,
          body,
        };
      } catch (error) {
        if (signal?.aborted) {
          QueueExecutionCancellationUtil.throwIfAborted(signal);
        }

        throw error;
      } finally {
        linked.cleanup();
      }
    }

    throw new Error('Official source exceeded redirect limit.');
  }

  private async readLimitedBody(response: Response): Promise<string> {
    const contentLengthHeader = response.headers.get('content-length');

    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_RESPONSE_BYTES
      ) {
        throw new Error('Official source response is too large.');
      }
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('Official source response is too large.');
    }

    return new TextDecoder('utf-8').decode(buffer);
  }

  private async assertPublicUrl(rawUrl: string): Promise<void> {
    const url = new URL(rawUrl);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS official sources are allowed.');
    }

    if (url.username || url.password) {
      throw new Error('Official source URL cannot contain credentials.');
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new Error('Private hostnames are not allowed.');
    }

    const records = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (records.length === 0) {
      throw new Error('Official source hostname cannot be resolved.');
    }

    for (const record of records) {
      if (!this.isPublicIp(record.address)) {
        throw new Error('Official source resolved to a private address.');
      }
    }
  }

  private isPublicIp(address: string): boolean {
    const normalized = address.toLowerCase();

    if (normalized.startsWith('::ffff:')) {
      return this.isPublicIp(normalized.slice(7));
    }

    const version = isIP(normalized);

    if (version === 4) {
      const [a, b] = normalized.split('.').map(Number);

      return !(
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
      );
    }

    if (version === 6) {
      return !(
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb') ||
        normalized.startsWith('ff')
      );
    }

    return false;
  }

  private appendSearchQuery(endpoint: string, query: string): string {
    const url = new URL(endpoint);
    url.searchParams.set('q', query);

    if (!url.searchParams.has('format')) {
      url.searchParams.set('format', 'json');
    }

    return url.toString();
  }

  private aliasPreservesIdentity(
    alias: string,
    deterministicAliases: string[],
  ): boolean {
    const compactAlias = this.compact(alias);

    return deterministicAliases.some((item) => {
      const compactItem = this.compact(item);

      return (
        compactItem.length >= 4 &&
        (compactAlias.includes(compactItem) ||
          compactItem.includes(compactAlias))
      );
    });
  }

  private looksLikeManufacturerIdentifier(value: string): boolean {
    const compact = this.compact(value);

    return (
      (compact.length >= 4 &&
        compact.length <= 40 &&
        /\p{L}/u.test(compact) &&
        /\d/u.test(compact)) ||
      /^\d{8,14}$/.test(compact)
    );
  }

  private brandAliases(identity: OfficialProductIdentity): string[] {
    return this.uniqueStrings([
      identity.brandName ?? '',
      ...(identity.brandName?.split(/[\s/&,+-]+/) ?? []),
    ]).filter((item) => this.compact(item).length >= 3);
  }

  private normalizeHostnameCandidate(value: string): string | null {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed || trimmed.includes('/') || trimmed.includes('@')) {
      return null;
    }

    try {
      const hostname = new URL(`https://${trimmed}`).hostname
        .toLowerCase()
        .replace(/^www\./, '');

      return hostname.includes('.') ? hostname : null;
    } catch {
      return null;
    }
  }

  private isMarketplaceHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase().replace(/^www\./, '');

    return MARKETPLACE_HOST_MARKERS.some((marker) =>
      normalized.includes(marker),
    );
  }

  private isAssetPath(pathname: string): boolean {
    return /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|mp4|pdf|png|svg|webp|woff2?|xml\.gz)$/i.test(
      pathname,
    );
  }

  private isVexoDomain(rawUrl: string): boolean {
    const hostname = this.hostname(rawUrl);

    return hostname === 'vexobeauty.ir' || hostname.endsWith('.vexobeauty.ir');
  }

  private safeOrigin(rawUrl: string | null | undefined): string | null {
    if (!rawUrl?.trim()) {
      return null;
    }

    try {
      const normalized = this.normalizeHttpUrl(rawUrl);
      const url = new URL(normalized);

      return url.origin;
    } catch {
      return null;
    }
  }

  private safeHttpUrl(rawUrl: string | null | undefined): string | null {
    if (!rawUrl?.trim()) {
      return null;
    }

    try {
      return this.normalizeHttpUrl(rawUrl);
    } catch {
      return null;
    }
  }

  private normalizeHttpUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed.');
    }

    url.hash = '';
    return url.toString();
  }

  private hostname(rawUrl: string | null | undefined): string {
    if (!rawUrl) {
      return '';
    }

    try {
      return new URL(this.normalizeHttpUrl(rawUrl)).hostname
        .toLowerCase()
        .replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  private sameHostname(first: string, second: string): boolean {
    const normalizedFirst = first.toLowerCase().replace(/^www\./, '');
    const normalizedSecond = second.toLowerCase().replace(/^www\./, '');

    return Boolean(
      normalizedFirst &&
      normalizedSecond &&
      (normalizedFirst === normalizedSecond ||
        normalizedFirst.endsWith(`.${normalizedSecond}`) ||
        normalizedSecond.endsWith(`.${normalizedFirst}`)),
    );
  }

  private compact(value: string): string {
    return value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      const trimmed = value.trim();
      const key = trimmed.toLowerCase();

      if (!trimmed || seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(trimmed);
    }

    return result;
  }

  private safeStringArray(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.stringValue(item))
      .filter((item): item is string => Boolean(item))
      .map((item) => item.slice(0, 400))
      .slice(0, limit);
  }

  private firstString(value: unknown): string | null {
    const direct = this.stringValue(value);

    if (direct) {
      return direct;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = this.firstString(item);

        if (resolved) {
          return resolved;
        }
      }

      return null;
    }

    const record = this.toRecord(value);

    if (Object.keys(record).length === 0) {
      return null;
    }

    for (const key of ['name', 'value', 'url', '@id']) {
      const resolved = this.firstString(record[key]);

      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private stringValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      return trimmed || null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private matchMeta(html: string, pattern: RegExp): string | null {
    return pattern.exec(html)?.[1] ?? null;
  }

  private decodeEntities(value: string): string {
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ');
  }

  private looksLikeUrl(value: string): boolean {
    return /:\/\//.test(value) || /^www\./i.test(value.trim());
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
