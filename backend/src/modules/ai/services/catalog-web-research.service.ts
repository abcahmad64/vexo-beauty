import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { QueueExecutionCancellationUtil } from '../../../core/queue/utils/queue-execution-cancellation.util';

import {
  OfficialProductIdentity,
  OfficialProductPageEvaluation,
  OfficialProductPageResolverService,
} from './official-product-page-resolver.service';

type CatalogWebResearchPayload = {
  researchRunId: string;
  productId: string;
};

export type CatalogManualSourceResearchPayload = {
  researchRunId: string;
  productId: string;
  sourceUrl: string;
  sourceType?: string;
  isOfficial: boolean;
  requestedById: string;
};

type ResearchIdentityRow = OfficialProductIdentity;

type ResearchCandidate = {
  url: string;
  sourceType: string;
  isOfficial: boolean;
  declaredByAdmin: boolean;
  officialHostname: string | null;
  discoveryMethod: string | null;
  discoveryScore: number | null;
  aliases: string[];
};

type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
};

type ExtractedLink = {
  url: string;
  text: string;
};

type JsonLdProduct = Record<string, unknown>;

type ExtractedPage = {
  title: string | null;
  heading: string | null;
  description: string | null;
  language: string | null;
  canonicalUrl: string | null;
  imageUrl: string | null;
  text: string;
  links: ExtractedLink[];
  jsonLdProducts: JsonLdProduct[];
};

type SuggestionDraft = {
  fieldPath: string;
  normalizedValue: Prisma.InputJsonValue;
  displayValue: string | null;
  unit: string | null;
  sourceExcerpt: string | null;
  confidence: number;
  verificationStatus: string;
};

type AutomaticCandidateRejection = {
  url: string;
  classification: OfficialProductPageEvaluation['classification'];
  reasons: string[];
};

type IngestResult = {
  sourceId: string | null;
  suggestionsCreated: number;
  suggestionsUpdated: number;
  discoveredCandidates: ResearchCandidate[];
  rejection: AutomaticCandidateRejection | null;
};

const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_SOURCE_COUNT_PER_RUN = 20;
const MAX_AUTOMATIC_CANDIDATES = 8;
const MAX_DISCOVERED_CANDIDATES_PER_PAGE = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = 'VEXO-Catalog-Research/2.0 (+https://vexobeauty.ir)';

const GENERIC_SEARCH_TOKENS = new Set([
  'product',
  'products',
  'official',
  'shop',
  'store',
  'brand',
  'model',
  'beauty',
  'care',
  'محصول',
  'محصولات',
  'فروشگاه',
  'برند',
  'مدل',
]);

@Injectable()
export class CatalogWebResearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officialPageResolver: OfficialProductPageResolverService,
  ) {}

  async research(
    payload: CatalogWebResearchPayload,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<Record<string, unknown>> {
    const { signal } = options;

    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const researchRunId = this.requireString(
      payload.researchRunId,
      'researchRunId',
    );
    const productId = this.requireString(payload.productId, 'productId');

    const run = await this.findRun(researchRunId, productId);

    if (
      !['READY_FOR_WEB_RESEARCH', 'WEB_RESEARCH_FAILED'].includes(run.status)
    ) {
      throw new BadRequestException(
        'وضعیت پرونده برای اجرای تحقیق وب معتبر نیست.',
      );
    }

    const identity = await this.findResearchIdentity(productId);

    if (!identity) {
      throw new NotFoundException('محصول مربوط به تحقیق پیدا نشد.');
    }

    const officialPageDiscovery = await this.officialPageResolver.discover(
      identity,
      { signal },
    );
    const queue = this.mergeCandidateUrls([
      ...officialPageDiscovery.candidates.map((candidate) => ({
        url: candidate.url,
        sourceType: candidate.sourceType,
        isOfficial: true,
        declaredByAdmin: false,
        officialHostname: candidate.officialHostname,
        discoveryMethod: candidate.discoveryMethod,
        discoveryScore: candidate.score,
        aliases: candidate.aliases,
      })),
      ...this.buildCandidateUrls(identity),
    ]);

    if (queue.length === 0) {
      await this.prisma.catalogResearchRun.update({
        where: {
          id: researchRunId,
        },
        data: {
          status: 'READY_FOR_REVIEW',
          finishedAt: new Date(),
          errorMessage: null,
          progressJson: {
            stage: 'READY_FOR_REVIEW',
            percent: 70,
          },
          summaryJson: {
            trustedSourceCandidates: 0,
            sourcesFetched: 0,
            suggestionsCreated: 0,
            suggestionsUpdated: 0,
            pendingSuggestions: 0,
            conflictSuggestions: 0,
            reason: officialPageDiscovery.status,
            officialPageDiscovery,
          },
        },
      });

      return {
        task: 'catalog.research.web',
        researchRunId,
        productId,
        status: 'READY_FOR_REVIEW',
        sourcesFetched: 0,
        suggestionsCreated: 0,
        suggestionsUpdated: 0,
        reason: officialPageDiscovery.status,
        officialPageDiscovery,
      };
    }

    await this.prisma.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status: 'WEB_RESEARCH_PROCESSING',
        errorMessage: null,
        progressJson: {
          stage: 'TRUSTED_SOURCE_RESEARCH',
          percent: 45,
        },
      },
    });

    const visited = new Set<string>();
    const failures: Array<Record<string, string>> = [];
    let sourcesFetched = 0;
    let suggestionsCreated = 0;
    let suggestionsUpdated = 0;
    const rejectedCandidates: AutomaticCandidateRejection[] = [];

    while (queue.length > 0 && visited.size < MAX_AUTOMATIC_CANDIDATES) {
      QueueExecutionCancellationUtil.throwIfAborted(signal);
      const candidate = queue.shift();

      if (!candidate) {
        break;
      }

      const normalizedUrl = this.normalizeHttpUrl(candidate.url);

      if (visited.has(normalizedUrl)) {
        continue;
      }

      visited.add(normalizedUrl);

      try {
        const result = await this.ingestCandidate(
          researchRunId,
          productId,
          identity,
          {
            ...candidate,
            url: normalizedUrl,
          },
          signal,
        );

        if (result.rejection) {
          rejectedCandidates.push(result.rejection);
          continue;
        }

        sourcesFetched += 1;
        suggestionsCreated += result.suggestionsCreated;
        suggestionsUpdated += result.suggestionsUpdated;

        for (const discovered of result.discoveredCandidates) {
          if (
            queue.length + visited.size >= MAX_AUTOMATIC_CANDIDATES ||
            visited.has(discovered.url) ||
            queue.some((item) => item.url === discovered.url)
          ) {
            continue;
          }

          queue.push(discovered);
        }
      } catch (error) {
        if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
          throw error;
        }

        failures.push({
          url: normalizedUrl,
          error: this.errorMessage(error),
        });
      }
    }

    QueueExecutionCancellationUtil.throwIfAborted(signal);
    await this.reconcileConflicts(researchRunId);

    const hasReviewableResult =
      sourcesFetched > 0 || rejectedCandidates.length > 0;
    const status = hasReviewableResult
      ? 'READY_FOR_REVIEW'
      : 'WEB_RESEARCH_FAILED';
    const reason =
      sourcesFetched > 0
        ? 'EXACT_OFFICIAL_SOURCE_DISCOVERED'
        : rejectedCandidates.length > 0
          ? 'NO_EXACT_OFFICIAL_SOURCE'
          : 'WEB_RESEARCH_FAILED';

    const summary = await this.buildRunSummary(researchRunId, {
      officialPageDiscovery,
      reason,
      candidatesEvaluated: visited.size,
      candidatesRejected: rejectedCandidates.length,
      rejectedCandidates,
      trustedSourceCandidates: sourcesFetched,
      sourcesFetched,
      suggestionsCreated,
      suggestionsUpdated,
      failures,
    });

    await this.prisma.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status,
        finishedAt: new Date(),
        errorMessage:
          status === 'READY_FOR_REVIEW'
            ? null
            : (failures[0]?.error ?? 'Trusted source research failed.'),
        progressJson: {
          stage: status,
          percent: status === 'READY_FOR_REVIEW' ? 70 : 45,
        },
        summaryJson: summary,
      },
    });

    return {
      task: 'catalog.research.web',
      researchRunId,
      productId,
      status,
      sourcesFetched,
      suggestionsCreated,
      suggestionsUpdated,
      officialPageDiscovery,
      reason,
      rejectedCandidates,
      failures,
    };
  }

  async researchManualSource(
    payload: CatalogManualSourceResearchPayload,
  ): Promise<Record<string, unknown>> {
    const researchRunId = this.requireString(
      payload.researchRunId,
      'researchRunId',
    );
    const productId = this.requireString(payload.productId, 'productId');
    const requestedById = this.requireString(
      payload.requestedById,
      'requestedById',
    );
    const sourceUrl = this.normalizeHttpUrl(
      this.requireString(payload.sourceUrl, 'sourceUrl'),
    );

    const run = await this.findRun(researchRunId, productId);

    if (['PROCESSING', 'WEB_RESEARCH_PROCESSING'].includes(run.status)) {
      throw new BadRequestException(
        'تا پایان پردازش جاری، منبع جدیدی به پرونده اضافه نکنید.',
      );
    }

    const sourceCount = await this.prisma.catalogResearchSource.count({
      where: {
        researchRunId,
        deletedAt: null,
      },
    });

    if (sourceCount >= MAX_SOURCE_COUNT_PER_RUN) {
      throw new BadRequestException(
        'حداکثر تعداد منابع مجاز برای این پرونده تحقیق ثبت شده است.',
      );
    }

    const identity = await this.findResearchIdentity(productId);

    if (!identity) {
      throw new NotFoundException('محصول مربوط به تحقیق پیدا نشد.');
    }

    await this.prisma.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status: 'WEB_RESEARCH_PROCESSING',
        errorMessage: null,
        progressJson: {
          stage: 'ADMIN_SOURCE_RESEARCH',
          percent: 55,
        },
      },
    });

    try {
      const result = await this.ingestCandidate(
        researchRunId,
        productId,
        identity,
        {
          url: sourceUrl,
          sourceType: payload.sourceType ?? 'MANUAL_SOURCE',
          isOfficial: payload.isOfficial,
          declaredByAdmin: true,
          officialHostname: payload.isOfficial
            ? new URL(sourceUrl).hostname
            : null,
          discoveryMethod: 'ADMIN_MANUAL_SOURCE',
          discoveryScore: null,
          aliases: [],
        },
      );

      await this.reconcileConflicts(researchRunId);

      const summary = await this.buildRunSummary(researchRunId, {
        lastManualSourceUrl: sourceUrl,
        lastManualSourceRequestedById: requestedById,
        lastManualSourceAt: new Date().toISOString(),
      });

      await this.prisma.catalogResearchRun.update({
        where: {
          id: researchRunId,
        },
        data: {
          status: 'READY_FOR_REVIEW',
          finishedAt: new Date(),
          errorMessage: null,
          progressJson: {
            stage: 'READY_FOR_REVIEW',
            percent: 70,
          },
          summaryJson: summary,
        },
      });

      if (!result.sourceId) {
        throw new Error(
          'Manual source ingestion did not create a source record.',
        );
      }

      const source = await this.prisma.catalogResearchSource.findUnique({
        where: {
          id: result.sourceId,
        },
      });

      return {
        researchRunId,
        productId,
        status: 'READY_FOR_REVIEW',
        source,
        suggestionsCreated: result.suggestionsCreated,
        suggestionsUpdated: result.suggestionsUpdated,
        canonicalProductUpdated: false,
      };
    } catch (error) {
      await this.prisma.catalogResearchRun.update({
        where: {
          id: researchRunId,
        },
        data: {
          status: 'READY_FOR_REVIEW',
          errorMessage: this.errorMessage(error),
          progressJson: {
            stage: 'MANUAL_SOURCE_FAILED',
            percent: 70,
          },
        },
      });

      throw error;
    }
  }

  private async ingestCandidate(
    researchRunId: string,
    productId: string,
    identity: ResearchIdentityRow,
    candidate: ResearchCandidate,
    signal?: AbortSignal,
  ): Promise<IngestResult> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const fetched = await this.fetchTrustedUrl(candidate.url, signal);
    const extracted = this.extractPage(fetched.body, fetched.finalUrl);
    const officialPageEvaluation = this.officialPageResolver.evaluatePage(
      identity,
      candidate.officialHostname,
      {
        requestedUrl: candidate.url,
        finalUrl: fetched.finalUrl,
        canonicalUrl: extracted.canonicalUrl,
        title: extracted.title,
        heading: extracted.heading,
        description: extracted.description,
        text: extracted.text,
        imageUrl: extracted.imageUrl,
        jsonLdProducts: extracted.jsonLdProducts,
      },
    );
    const evaluatedCandidate: ResearchCandidate = {
      ...candidate,
      isOfficial:
        candidate.isOfficial && officialPageEvaluation.officialDomainMatch,
    };
    const relevanceScore = this.calculateRelevance(identity, extracted);
    const trust = this.resolveTrust(
      evaluatedCandidate,
      identity,
      fetched.finalUrl,
      officialPageEvaluation,
    );

    if (extracted.text.length < 40 && extracted.jsonLdProducts.length === 0) {
      throw new Error('Fetched page does not contain usable product evidence.');
    }

    if (!candidate.declaredByAdmin && !officialPageEvaluation.exactMatch) {
      return {
        sourceId: null,
        suggestionsCreated: 0,
        suggestionsUpdated: 0,
        discoveredCandidates: [],
        rejection: {
          url: fetched.finalUrl,
          classification: officialPageEvaluation.classification,
          reasons: officialPageEvaluation.reasons,
        },
      };
    }

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    const source = await this.prisma.catalogResearchSource.upsert({
      where: {
        researchRunId_sourceUrl: {
          researchRunId,
          sourceUrl: candidate.url,
        },
      },
      create: {
        researchRunId,
        sourceType: candidate.sourceType,
        sourceUrl: candidate.url,
        canonicalUrl: extracted.canonicalUrl ?? fetched.finalUrl,
        domain: new URL(fetched.finalUrl).hostname,
        title: extracted.title,
        language: extracted.language,
        publisher: identity.brandName,
        httpStatus: fetched.status,
        contentHash: createHash('sha256').update(fetched.body).digest('hex'),
        extractedText: extracted.text,
        metadataJson: {
          contentType: fetched.contentType,
          fetchedBy: candidate.declaredByAdmin
            ? 'ADMIN_MANUAL_SOURCE'
            : 'CATALOG_WEB_RESEARCH',
          relevanceScore,
          jsonLdProductCount: extracted.jsonLdProducts.length,
          declaredByAdmin: evaluatedCandidate.declaredByAdmin,
          discoveryMethod: evaluatedCandidate.discoveryMethod,
          discoveryScore: evaluatedCandidate.discoveryScore,
          officialPageEvaluation,
        },
        trustScore: trust.score,
        verification: officialPageEvaluation.exactMatch
          ? 'EXACT_OFFICIAL_PRODUCT_PAGE'
          : trust.verification,
        isOfficial: evaluatedCandidate.isOfficial,
        isAccessible: true,
      },
      update: {
        sourceType: candidate.sourceType,
        canonicalUrl: extracted.canonicalUrl ?? fetched.finalUrl,
        domain: new URL(fetched.finalUrl).hostname,
        title: extracted.title,
        language: extracted.language,
        publisher: identity.brandName,
        retrievedAt: new Date(),
        httpStatus: fetched.status,
        contentHash: createHash('sha256').update(fetched.body).digest('hex'),
        extractedText: extracted.text,
        metadataJson: {
          contentType: fetched.contentType,
          fetchedBy: candidate.declaredByAdmin
            ? 'ADMIN_MANUAL_SOURCE'
            : 'CATALOG_WEB_RESEARCH',
          relevanceScore,
          jsonLdProductCount: extracted.jsonLdProducts.length,
          declaredByAdmin: evaluatedCandidate.declaredByAdmin,
          discoveryMethod: evaluatedCandidate.discoveryMethod,
          discoveryScore: evaluatedCandidate.discoveryScore,
          officialPageEvaluation,
        },
        trustScore: trust.score,
        verification: officialPageEvaluation.exactMatch
          ? 'EXACT_OFFICIAL_PRODUCT_PAGE'
          : trust.verification,
        isOfficial: evaluatedCandidate.isOfficial,
        isAccessible: true,
        deletedAt: null,
      },
    });

    const suggestions = this.buildSuggestions(
      identity,
      evaluatedCandidate,
      extracted,
      relevanceScore,
      trust.score,
      officialPageEvaluation,
    );

    let suggestionsCreated = 0;
    let suggestionsUpdated = 0;

    for (const suggestion of suggestions) {
      QueueExecutionCancellationUtil.throwIfAborted(signal);
      const result = await this.upsertPendingSuggestion(
        researchRunId,
        productId,
        source.id,
        suggestion,
      );

      if (result === 'CREATED') {
        suggestionsCreated += 1;
      } else if (result === 'UPDATED') {
        suggestionsUpdated += 1;
      }
    }

    return {
      sourceId: source.id,
      suggestionsCreated,
      suggestionsUpdated,
      discoveredCandidates: evaluatedCandidate.isOfficial
        ? this.discoverProductLinks(
            identity,
            fetched.finalUrl,
            extracted.links,
            evaluatedCandidate,
          )
        : [],
      rejection: null,
    };
  }

  private async findRun(researchRunId: string, productId: string) {
    const run = await this.prisma.catalogResearchRun.findUnique({
      where: {
        id: researchRunId,
      },
    });

    if (!run || run.deletedAt) {
      throw new NotFoundException('پرونده تحقیق کاتالوگ پیدا نشد.');
    }

    if (run.productId !== productId) {
      throw new BadRequestException('محصول با پرونده تحقیق مطابقت ندارد.');
    }

    return run;
  }

  private async findResearchIdentity(
    productId: string,
  ): Promise<ResearchIdentityRow | null> {
    const rows = await this.prisma.$queryRaw<
      Array<Omit<ResearchIdentityRow, 'variantIdentifiers'>>
    >(
      Prisma.sql`
        SELECT
          p."id" AS "productId",
          p."name" AS "productName",
          p."sku" AS "productSku",
          p."canonicalUrl",
          p."brandId",
          b."name" AS "brandName",
          b."website" AS "brandWebsite",
          p."productModelId",
          pm."name" AS "productModelName",
          pm."modelCode" AS "productModelCode"
        FROM "Product" p
        LEFT JOIN "Brand" b
          ON b."id" = p."brandId"
         AND b."deleted_at" IS NULL
        LEFT JOIN "ProductModel" pm
          ON pm."id" = p."productModelId"
         AND pm."deleted_at" IS NULL
        WHERE p."id" = ${productId}
          AND p."deleted_at" IS NULL
        LIMIT 1
      `,
    );

    const product = rows[0];

    if (!product) {
      return null;
    }

    const variants = await this.prisma.productVariant.findMany({
      where: {
        productId,
        deletedAt: null,
      },
      select: {
        sku: true,
        barcode: true,
        gtin: true,
        mpn: true,
      },
      take: 100,
    });

    const variantIdentifiers = [
      product.productSku,
      ...variants.flatMap((variant) => [
        variant.sku,
        variant.barcode,
        variant.gtin,
        variant.mpn,
      ]),
    ].filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    );

    return {
      ...product,
      variantIdentifiers: [...new Set(variantIdentifiers)],
    };
  }

  private buildCandidateUrls(
    identity: ResearchIdentityRow,
  ): ResearchCandidate[] {
    const candidates: ResearchCandidate[] = [];

    const add = (
      rawUrl: string | null,
      sourceType: string,
      isOfficial: boolean,
    ) => {
      if (!rawUrl) {
        return;
      }

      const normalized = this.normalizeHttpUrl(rawUrl);

      if (this.isVexoDomain(normalized)) {
        return;
      }

      if (candidates.some((candidate) => candidate.url === normalized)) {
        return;
      }

      candidates.push({
        url: normalized,
        sourceType,
        isOfficial,
        declaredByAdmin: false,
        officialHostname: isOfficial ? new URL(normalized).hostname : null,
        discoveryMethod: sourceType,
        discoveryScore: null,
        aliases: [],
      });
    };

    add(identity.brandWebsite, 'BRAND_OFFICIAL', true);
    add(identity.canonicalUrl, 'PRODUCT_CANONICAL', false);

    return candidates;
  }

  private mergeCandidateUrls(
    candidates: ResearchCandidate[],
  ): ResearchCandidate[] {
    const merged = new Map<string, ResearchCandidate>();

    for (const candidate of candidates) {
      const normalized = this.normalizeHttpUrl(candidate.url);
      const existing = merged.get(normalized);

      if (
        !existing ||
        (candidate.discoveryScore ?? 0) > (existing.discoveryScore ?? 0) ||
        (candidate.isOfficial && !existing.isOfficial)
      ) {
        merged.set(normalized, {
          ...candidate,
          url: normalized,
          aliases: [...new Set(candidate.aliases)],
        });
      }
    }

    return [...merged.values()];
  }

  private resolveTrust(
    candidate: ResearchCandidate,
    identity: ResearchIdentityRow,
    finalUrl: string,
    officialPageEvaluation: OfficialProductPageEvaluation,
  ): {
    score: number;
    verification: string;
  } {
    const brandDomainMatches = this.sameDomain(identity.brandWebsite, finalUrl);

    if (officialPageEvaluation.exactMatch) {
      return {
        score: 99,
        verification: 'EXACT_OFFICIAL_PRODUCT_PAGE',
      };
    }

    if (candidate.isOfficial && brandDomainMatches) {
      return {
        score: 96,
        verification: 'OFFICIAL_DOMAIN_MATCH',
      };
    }

    if (candidate.isOfficial && candidate.declaredByAdmin) {
      return {
        score: 88,
        verification: 'ADMIN_DECLARED_OFFICIAL',
      };
    }

    if (candidate.sourceType === 'REGULATORY') {
      return {
        score: 92,
        verification: 'ADMIN_REGULATORY_SOURCE',
      };
    }

    if (candidate.declaredByAdmin) {
      return {
        score: 76,
        verification: 'ADMIN_TRUSTED',
      };
    }

    return {
      score: 70,
      verification: 'TRUSTED',
    };
  }

  private buildSuggestions(
    identity: ResearchIdentityRow,
    candidate: ResearchCandidate,
    extracted: ExtractedPage,
    relevanceScore: number,
    trustScore: number,
    officialPageEvaluation: OfficialProductPageEvaluation,
  ): SuggestionDraft[] {
    const suggestions: SuggestionDraft[] = [];
    const dedupe = new Set<string>();
    const sourceVerified =
      candidate.isOfficial || trustScore >= 90
        ? 'SOURCE_VERIFIED'
        : 'SOURCE_REVIEW_REQUIRED';

    const add = (
      fieldPath: string,
      rawValue: unknown,
      confidence: number,
      sourceExcerpt?: string | null,
      unit?: string | null,
      verificationStatus?: string,
    ) => {
      const normalizedValue = this.toJsonInput(rawValue);

      if (normalizedValue === null) {
        return;
      }

      const displayValue = this.displayValue(normalizedValue);
      const key = `${fieldPath}:${this.stableValue(normalizedValue)}`;

      if (!displayValue || dedupe.has(key)) {
        return;
      }

      dedupe.add(key);

      suggestions.push({
        fieldPath,
        normalizedValue,
        displayValue,
        unit: unit ?? null,
        sourceExcerpt:
          sourceExcerpt?.trim().slice(0, 1500) ?? displayValue.slice(0, 1500),
        confidence: Math.min(
          99,
          Math.max(1, Math.round(confidence * (0.7 + trustScore / 330))),
        ),
        verificationStatus: verificationStatus ?? sourceVerified,
      });
    };

    const productNode = this.bestJsonLdProduct(
      identity,
      extracted.jsonLdProducts,
    );

    if (productNode && officialPageEvaluation.exactMatch) {
      const name = this.firstString(productNode.name);
      const description = this.firstString(productNode.description);
      const sku = this.firstString(productNode.sku);
      const mpn = this.firstString(productNode.mpn);
      const brand = this.firstString(productNode.brand);
      const image = this.firstString(productNode.image);
      const url = this.firstString(productNode.url);
      const gtin = this.firstAvailableString(productNode, [
        'gtin14',
        'gtin13',
        'gtin12',
        'gtin8',
        'gtin',
      ]);

      add('product.name', name, 96, name);
      add('product.description', description, 92, description);
      add('product.brandName', brand, 96, brand);
      add('variant.sku', this.normalizeCode(sku), 94, sku);
      add('variant.mpn', this.normalizeCode(mpn), 95, mpn);
      add('variant.gtin', this.normalizeDigits(gtin), 98, gtin);
      add(
        'product.primaryImageUrl',
        officialPageEvaluation.imageUrl ?? image,
        90,
        officialPageEvaluation.imageUrl ?? image,
        null,
        'OFFICIAL_MEDIA_IMPORT_REQUIRED',
      );
      add(
        'product.canonicalUrl',
        officialPageEvaluation.canonicalUrl ?? url,
        98,
        officialPageEvaluation.canonicalUrl ?? url,
        null,
        'EXACT_OFFICIAL_PRODUCT_PAGE',
      );

      this.addAdditionalProperties(productNode, add);
      this.addOfferEvidence(productNode, add);
    }

    if (
      officialPageEvaluation.exactMatch &&
      officialPageEvaluation.canonicalUrl
    ) {
      add(
        'product.canonicalUrl',
        officialPageEvaluation.canonicalUrl,
        98,
        officialPageEvaluation.canonicalUrl,
        null,
        'EXACT_OFFICIAL_PRODUCT_PAGE',
      );
    }

    if (officialPageEvaluation.exactMatch && officialPageEvaluation.imageUrl) {
      add(
        'product.primaryImageUrl',
        officialPageEvaluation.imageUrl,
        88,
        officialPageEvaluation.imageUrl,
        null,
        'OFFICIAL_MEDIA_IMPORT_REQUIRED',
      );
    }

    if (relevanceScore >= 55) {
      add(
        'research.sourceTitle',
        extracted.title,
        candidate.isOfficial ? 82 : 70,
        extracted.title,
      );
      add(
        'research.sourceDescription',
        extracted.description,
        candidate.isOfficial ? 80 : 68,
        extracted.description,
      );
    }

    if (
      suggestions.length === 0 &&
      relevanceScore >= 70 &&
      extracted.description
    ) {
      add(
        'product.shortDescription',
        extracted.description,
        candidate.isOfficial ? 74 : 62,
        extracted.description,
      );
    }

    return suggestions;
  }

  private addAdditionalProperties(
    productNode: JsonLdProduct,
    add: (
      fieldPath: string,
      value: unknown,
      confidence: number,
      sourceExcerpt?: string | null,
      unit?: string | null,
    ) => void,
  ): void {
    const properties = productNode.additionalProperty;

    if (!Array.isArray(properties)) {
      return;
    }

    for (const item of properties.slice(0, 30)) {
      const record = this.toRecord(item);
      const name = this.firstString(record.name);
      const value = this.firstString(record.value);
      const unit = this.firstString(record.unitText);

      if (!name || !value) {
        continue;
      }

      const key = this.slugifyField(name);

      if (!key) {
        continue;
      }

      add(`research.attribute.${key}`, value, 88, `${name}: ${value}`, unit);
    }
  }

  private addOfferEvidence(
    productNode: JsonLdProduct,
    add: (
      fieldPath: string,
      value: unknown,
      confidence: number,
      sourceExcerpt?: string | null,
      unit?: string | null,
    ) => void,
  ): void {
    const offersValue = productNode.offers;
    const offers = Array.isArray(offersValue)
      ? offersValue
      : offersValue
        ? [offersValue]
        : [];

    const offer = this.toRecord(offers[0]);

    if (Object.keys(offer).length === 0) {
      return;
    }

    const price = this.firstString(offer.price);
    const currency = this.firstString(offer.priceCurrency);
    const availability = this.firstString(offer.availability);

    add('market.referencePrice', price, 78, price, currency);
    add('market.priceCurrency', currency, 82, currency);
    add('market.availability', availability, 76, availability);
  }

  private async upsertPendingSuggestion(
    researchRunId: string,
    productId: string,
    sourceId: string,
    suggestion: SuggestionDraft,
  ): Promise<'CREATED' | 'UPDATED' | 'UNCHANGED'> {
    const existing = await this.prisma.catalogResearchFieldSuggestion.findFirst(
      {
        where: {
          researchRunId,
          productId,
          sourceId,
          fieldPath: suggestion.fieldPath,
          adminDecision: 'PENDING',
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    );

    if (existing) {
      const unchanged =
        this.stableValue(existing.normalizedValue) ===
          this.stableValue(suggestion.normalizedValue) &&
        existing.displayValue === suggestion.displayValue &&
        Number(existing.confidence) === suggestion.confidence;

      if (unchanged) {
        return 'UNCHANGED';
      }

      await this.prisma.catalogResearchFieldSuggestion.update({
        where: {
          id: existing.id,
        },
        data: {
          normalizedValue: suggestion.normalizedValue,
          displayValue: suggestion.displayValue,
          unit: suggestion.unit,
          sourceExcerpt: suggestion.sourceExcerpt,
          confidence: suggestion.confidence,
          verificationStatus: suggestion.verificationStatus,
          conflictGroup: null,
        },
      });

      return 'UPDATED';
    }

    await this.prisma.catalogResearchFieldSuggestion.create({
      data: {
        researchRunId,
        sourceId,
        productId,
        fieldPath: suggestion.fieldPath,
        normalizedValue: suggestion.normalizedValue,
        displayValue: suggestion.displayValue,
        unit: suggestion.unit,
        sourceExcerpt: suggestion.sourceExcerpt,
        confidence: suggestion.confidence,
        verificationStatus: suggestion.verificationStatus,
        adminDecision: 'PENDING',
      },
    });

    return 'CREATED';
  }

  private async reconcileConflicts(researchRunId: string): Promise<void> {
    const suggestions =
      await this.prisma.catalogResearchFieldSuggestion.findMany({
        where: {
          researchRunId,
          adminDecision: 'PENDING',
          deletedAt: null,
        },
        select: {
          id: true,
          fieldPath: true,
          normalizedValue: true,
          verificationStatus: true,
        },
      });

    const groups = new Map<string, typeof suggestions>();

    for (const suggestion of suggestions) {
      const current = groups.get(suggestion.fieldPath) ?? [];
      current.push(suggestion);
      groups.set(suggestion.fieldPath, current);
    }

    for (const [fieldPath, group] of groups) {
      const distinctValues = new Set(
        group.map((item) => this.stableValue(item.normalizedValue)),
      );
      const ids = group.map((item) => item.id);

      if (distinctValues.size > 1) {
        const conflictGroup = createHash('sha256')
          .update(`${researchRunId}:${fieldPath}`)
          .digest('hex')
          .slice(0, 20);

        await this.prisma.catalogResearchFieldSuggestion.updateMany({
          where: {
            id: {
              in: ids,
            },
          },
          data: {
            conflictGroup,
            verificationStatus: 'CONFLICT',
          },
        });
      } else {
        await this.prisma.catalogResearchFieldSuggestion.updateMany({
          where: {
            id: {
              in: ids,
            },
          },
          data: {
            conflictGroup: null,
            verificationStatus: group.some(
              (item) => item.verificationStatus === 'SOURCE_VERIFIED',
            )
              ? 'SOURCE_VERIFIED'
              : 'SOURCE_REVIEW_REQUIRED',
          },
        });
      }
    }
  }

  private async buildRunSummary(
    researchRunId: string,
    extra: Record<string, unknown>,
  ): Promise<Prisma.InputJsonObject> {
    const [run, sources, pending, approved, rejected, conflicts] =
      await Promise.all([
        this.prisma.catalogResearchRun.findUnique({
          where: {
            id: researchRunId,
          },
          select: {
            summaryJson: true,
          },
        }),
        this.prisma.catalogResearchSource.count({
          where: {
            researchRunId,
            deletedAt: null,
          },
        }),
        this.prisma.catalogResearchFieldSuggestion.count({
          where: {
            researchRunId,
            adminDecision: 'PENDING',
            deletedAt: null,
          },
        }),
        this.prisma.catalogResearchFieldSuggestion.count({
          where: {
            researchRunId,
            adminDecision: 'APPROVED',
            deletedAt: null,
          },
        }),
        this.prisma.catalogResearchFieldSuggestion.count({
          where: {
            researchRunId,
            adminDecision: 'REJECTED',
            deletedAt: null,
          },
        }),
        this.prisma.catalogResearchFieldSuggestion.count({
          where: {
            researchRunId,
            adminDecision: 'PENDING',
            conflictGroup: {
              not: null,
            },
            deletedAt: null,
          },
        }),
      ]);

    const summary: Record<string, Prisma.InputJsonValue | null> = {};
    const values: Record<string, unknown> = {
      ...this.toRecord(run?.summaryJson),
      ...extra,
      sourcesFetched: sources,
      pendingSuggestions: pending,
      approvedSuggestions: approved,
      rejectedSuggestions: rejected,
      conflictSuggestions: conflicts,
    };

    for (const [key, value] of Object.entries(values)) {
      const normalized = this.toJsonInput(value);

      if (normalized !== null) {
        summary[key] = normalized;
      }
    }

    return summary;
  }

  private calculateRelevance(
    identity: ResearchIdentityRow,
    extracted: ExtractedPage,
  ): number {
    const searchable = this.normalizeSearchText(
      [
        extracted.title,
        extracted.description,
        extracted.text.slice(0, 20_000),
        extracted.canonicalUrl,
      ]
        .filter(Boolean)
        .join(' '),
    );
    const tokens = this.identityTokens(identity);

    if (tokens.length === 0) {
      return extracted.jsonLdProducts.length > 0 ? 70 : 30;
    }

    let score = 0;

    for (const token of tokens) {
      if (searchable.includes(token)) {
        score += token.length >= 8 ? 18 : 10;
      }
    }

    if (extracted.jsonLdProducts.length > 0) {
      score += 25;
    }

    return Math.min(100, score);
  }

  private discoverProductLinks(
    identity: ResearchIdentityRow,
    baseUrl: string,
    links: ExtractedLink[],
    sourceCandidate: ResearchCandidate,
  ): ResearchCandidate[] {
    const base = new URL(baseUrl);
    const tokens = this.identityTokens(identity);

    return links
      .map((link) => {
        const url = new URL(link.url);

        if (!this.sameHostname(base.hostname, url.hostname)) {
          return null;
        }

        const searchable = this.normalizeSearchText(
          `${url.pathname} ${url.search} ${link.text}`,
        );
        let score = 0;

        for (const token of tokens) {
          if (searchable.includes(token)) {
            score += token.length >= 8 ? 3 : 2;
          }
        }

        if (/\/(product|products|item|catalog|shop)\b/i.test(url.pathname)) {
          score += 1;
        }

        if (
          score < 2 ||
          this.isAssetPath(url.pathname) ||
          url.pathname === '/' ||
          this.isVexoDomain(url.toString())
        ) {
          return null;
        }

        url.hash = '';

        return {
          url: url.toString(),
          score,
        };
      })
      .filter(
        (
          item,
        ): item is {
          url: string;
          score: number;
        } => item !== null,
      )
      .sort((a, b) => b.score - a.score)
      .filter(
        (item, index, all) =>
          all.findIndex((candidate) => candidate.url === item.url) === index,
      )
      .slice(0, MAX_DISCOVERED_CANDIDATES_PER_PAGE)
      .map((item) => ({
        url: item.url,
        sourceType: 'PRODUCT_OFFICIAL',
        isOfficial: sourceCandidate.isOfficial,
        declaredByAdmin: false,
        officialHostname: sourceCandidate.officialHostname,
        discoveryMethod: 'OFFICIAL_INTERNAL_LINK',
        discoveryScore: item.score,
        aliases: sourceCandidate.aliases,
      }));
  }

  private extractPage(html: string, finalUrl: string): ExtractedPage {
    const title =
      this.matchMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
      this.matchMeta(
        html,
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,
      );

    const heading = this.matchMeta(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

    const description =
      this.matchMeta(
        html,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
      ) ??
      this.matchMeta(
        html,
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
      );

    const language = this.matchMeta(
      html,
      /<html[^>]+lang=["']([^"']+)["'][^>]*>/i,
    );

    const canonicalRaw = this.matchMeta(
      html,
      /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    );

    const imageRaw = this.matchMeta(
      html,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    );

    const text = this.decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' '),
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120_000);

    return {
      title: title ? this.cleanText(title, 500) : null,
      heading: heading
        ? this.cleanText(heading.replace(/<[^>]+>/g, ' '), 500)
        : null,
      description: description ? this.cleanText(description, 3000) : null,
      language: language ? this.cleanText(language, 20).toLowerCase() : null,
      canonicalUrl: canonicalRaw
        ? this.resolveHttpUrl(canonicalRaw, finalUrl)
        : finalUrl,
      imageUrl: imageRaw ? this.resolveHttpUrl(imageRaw, finalUrl) : null,
      text,
      links: this.extractLinks(html, finalUrl),
      jsonLdProducts: this.extractJsonLdProducts(html),
    };
  }

  private extractLinks(html: string, baseUrl: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(pattern)) {
      const href = match[1]?.trim();
      const anchorText = this.cleanText(
        (match[2] ?? '').replace(/<[^>]+>/g, ' '),
        300,
      );

      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) {
        continue;
      }

      try {
        const resolved = this.resolveHttpUrl(href, baseUrl);

        if (!resolved) {
          continue;
        }

        links.push({
          url: resolved,
          text: anchorText,
        });
      } catch {
        continue;
      }

      if (links.length >= 600) {
        break;
      }
    }

    return links;
  }

  private extractJsonLdProducts(html: string): JsonLdProduct[] {
    const products: JsonLdProduct[] = [];
    const pattern =
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(pattern)) {
      const raw = match[1]?.trim();

      if (!raw) {
        continue;
      }

      try {
        const parsed: unknown = JSON.parse(
          raw.replace(/^\s*<!--/, '').replace(/-->\s*$/, ''),
        );

        this.collectJsonLdProducts(parsed, products);
      } catch {
        continue;
      }
    }

    return products.slice(0, 50);
  }

  private collectJsonLdProducts(
    value: unknown,
    products: JsonLdProduct[],
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectJsonLdProducts(item, products);
      }

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
        (type) => typeof type === 'string' && type.toLowerCase() === 'product',
      )
    ) {
      products.push(record);
    }

    if (record['@graph']) {
      this.collectJsonLdProducts(record['@graph'], products);
    }

    if (record.mainEntity) {
      this.collectJsonLdProducts(record.mainEntity, products);
    }
  }

  private bestJsonLdProduct(
    identity: ResearchIdentityRow,
    products: JsonLdProduct[],
  ): JsonLdProduct | null {
    if (products.length === 0) {
      return null;
    }

    const tokens = this.identityTokens(identity);

    return (
      products
        .map((product) => {
          const searchable = this.normalizeSearchText(
            [
              this.firstString(product.name),
              this.firstString(product.sku),
              this.firstString(product.mpn),
              this.firstAvailableString(product, [
                'gtin14',
                'gtin13',
                'gtin12',
                'gtin8',
                'gtin',
              ]),
            ]
              .filter(Boolean)
              .join(' '),
          );
          const score = tokens.reduce(
            (total, token) =>
              searchable.includes(token) ? total + token.length : total,
            0,
          );

          return {
            product,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)[0]?.product ??
      products[0] ??
      null
    );
  }

  private identityTokens(identity: ResearchIdentityRow): string[] {
    const values = [
      identity.productName,
      identity.productSku,
      identity.brandName,
      identity.productModelName,
      identity.productModelCode,
      ...identity.variantIdentifiers,
    ];

    const tokens = values.flatMap((value) =>
      this.normalizeSearchText(value ?? '')
        .split(' ')
        .filter(
          (token) => token.length >= 3 && !GENERIC_SEARCH_TOKENS.has(token),
        ),
    );

    return [...new Set(tokens)].slice(0, 40);
  }

  private firstAvailableString(
    record: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = this.firstString(record[key]);

      if (value) {
        return value;
      }
    }

    return null;
  }

  private firstString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toString();
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

    for (const key of ['name', 'value', 'url', '@id']) {
      const resolved = this.firstString(record[key]);

      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.toJsonInput(item))
        .filter((item): item is Prisma.InputJsonValue => item !== null);
    }

    const record = this.toRecord(value);
    const result: Record<string, Prisma.InputJsonValue | null> = {};

    for (const [key, item] of Object.entries(record)) {
      const normalized = this.toJsonInput(item);

      if (normalized !== null) {
        result[key] = normalized;
      }
    }

    return result;
  }

  private displayValue(value: Prisma.InputJsonValue): string {
    if (typeof value === 'string') {
      return value.trim().slice(0, 4000);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }

    try {
      return JSON.stringify(value).slice(0, 4000);
    } catch {
      return '';
    }
  }

  private stableValue(value: unknown): string {
    return JSON.stringify(this.sortJson(value)) ?? '';
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortJson(item));
    }

    const record = this.toRecord(value);

    if (Object.keys(record).length === 0) {
      return value;
    }

    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = this.sortJson(record[key]);

        return result;
      }, {});
  }

  private normalizeCode(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return value
      .replace(/\s+/g, '')
      .replace(/[‐‑‒–—−]/g, '-')
      .trim()
      .slice(0, 200);
  }

  private normalizeDigits(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const digits = value.replace(/\D/g, '');

    return digits.length > 0 ? digits.slice(0, 32) : null;
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

  private slugifyField(value: string): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '-').slice(0, 100);
  }

  private sameDomain(
    firstUrl: string | null,
    secondUrl: string | null,
  ): boolean {
    if (!firstUrl || !secondUrl) {
      return false;
    }

    try {
      return this.sameHostname(
        new URL(this.normalizeHttpUrl(firstUrl)).hostname,
        new URL(this.normalizeHttpUrl(secondUrl)).hostname,
      );
    } catch {
      return false;
    }
  }

  private sameHostname(first: string, second: string): boolean {
    const normalizedFirst = first.toLowerCase().replace(/^www\./, '');
    const normalizedSecond = second.toLowerCase().replace(/^www\./, '');

    return (
      normalizedFirst === normalizedSecond ||
      normalizedFirst.endsWith(`.${normalizedSecond}`) ||
      normalizedSecond.endsWith(`.${normalizedFirst}`)
    );
  }

  private isVexoDomain(rawUrl: string): boolean {
    try {
      const hostname = new URL(rawUrl).hostname
        .toLowerCase()
        .replace(/^www\./, '');

      return (
        hostname === 'vexobeauty.ir' || hostname.endsWith('.vexobeauty.ir')
      );
    } catch {
      return false;
    }
  }

  private isAssetPath(pathname: string): boolean {
    return /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|mp4|pdf|png|svg|webp|woff2?)$/i.test(
      pathname,
    );
  }

  private async fetchTrustedUrl(
    initialUrl: string,
    signal?: AbortSignal,
  ): Promise<FetchResult> {
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
            Accept: 'text/html,application/xhtml+xml,application/ld+json',
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
          throw new Error(`Trusted source returned HTTP ${response.status}.`);
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (
          !contentType.toLowerCase().includes('text/html') &&
          !contentType.toLowerCase().includes('application/xhtml+xml') &&
          !contentType.toLowerCase().includes('application/ld+json')
        ) {
          throw new Error(
            `Unsupported content type: ${contentType || 'unknown'}.`,
          );
        }

        const body = await this.readLimitedBody(response);

        return {
          requestedUrl: initialUrl,
          finalUrl: currentUrl,
          status: response.status,
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

    throw new Error('Trusted source exceeded redirect limit.');
  }

  private async readLimitedBody(response: Response): Promise<string> {
    const contentLengthHeader = response.headers.get('content-length');

    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);

      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_RESPONSE_BYTES
      ) {
        throw new Error('Trusted source response is too large.');
      }
    }

    const buffer: ArrayBuffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('Trusted source response is too large.');
    }

    return new TextDecoder('utf-8').decode(buffer);
  }

  private async assertPublicUrl(rawUrl: string): Promise<void> {
    const url = new URL(rawUrl);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('فقط آدرس‌های HTTP و HTTPS مجاز هستند.');
    }

    if (url.username || url.password) {
      throw new BadRequestException('آدرس دارای اطلاعات ورود مجاز نیست.');
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new BadRequestException('دسترسی به میزبان داخلی مجاز نیست.');
    }

    const records = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (records.length === 0) {
      throw new BadRequestException('میزبان آدرس قابل Resolve نیست.');
    }

    for (const record of records) {
      if (!this.isPublicIp(record.address)) {
        throw new BadRequestException(
          'آدرس به شبکه خصوصی یا رزروشده Resolve شد.',
        );
      }
    }
  }

  private isPublicIp(address: string): boolean {
    const normalizedAddress = address.toLowerCase();

    if (normalizedAddress.startsWith('::ffff:')) {
      return this.isPublicIp(normalizedAddress.slice(7));
    }

    const version = isIP(normalizedAddress);

    if (version === 4) {
      const parts = normalizedAddress.split('.').map(Number);
      const [a, b] = parts;

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
        normalizedAddress === '::' ||
        normalizedAddress === '::1' ||
        normalizedAddress.startsWith('fc') ||
        normalizedAddress.startsWith('fd') ||
        normalizedAddress.startsWith('fe8') ||
        normalizedAddress.startsWith('fe9') ||
        normalizedAddress.startsWith('fea') ||
        normalizedAddress.startsWith('feb') ||
        normalizedAddress.startsWith('ff')
      );
    }

    return false;
  }

  private normalizeHttpUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(withProtocol);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('فقط آدرس HTTP یا HTTPS مجاز است.');
    }

    url.hash = '';

    return url.toString();
  }

  private resolveHttpUrl(rawUrl: string, baseUrl: string): string | null {
    try {
      const url = new URL(rawUrl, baseUrl);

      if (!['http:', 'https:'].includes(url.protocol)) {
        return null;
      }

      url.hash = '';

      return url.toString();
    } catch {
      return null;
    }
  }

  private matchMeta(html: string, pattern: RegExp): string | null {
    const match = pattern.exec(html);

    return match?.[1] ?? null;
  }

  private cleanText(value: string, maxLength: number): string {
    return this.decodeEntities(value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  private decodeEntities(value: string): string {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`فیلد ${field} معتبر نیست.`);
    }

    return value.trim();
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown web research error.';
  }
}
