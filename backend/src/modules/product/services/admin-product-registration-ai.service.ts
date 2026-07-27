import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AI_PROVIDER } from '../../ai/constants/ai-provider.tokens';

import {
  AiCanonicalTaskType,
  AiProvider,
} from '../../ai/interfaces/ai-provider.interface';

import {
  AiGroundingEvidence,
  AiKnowledgeRetrievalService,
} from '../../ai/services/ai-knowledge-retrieval.service';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminProductAiRegistrationAssistDto,
  AdminProductAiRegistrationSection,
} from '../dto/admin-product-ai.dto';

import { AdminProductService } from './admin-product.service';

type JsonRecord = Record<string, unknown>;

type RegistrationEvidenceKind =
  | 'APPROVED_KNOWLEDGE'
  | 'RESEARCH_SUGGESTION'
  | 'ADMIN_KNOWLEDGE'
  | 'PRODUCT_CONTEXT';

type RegistrationEvidence = {
  id: string;
  kind: RegistrationEvidenceKind;
  fieldPath: string | null;
  title: string;
  content: string;
  displayValue: string | null;
  confidence: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceExcerpt: string | null;
  verificationStatus: string;
  conflictGroup: string | null;
  researchRunId: string | null;
  researchSuggestionId: string | null;
};

type RegistrationSuggestionRisk = 'LOW' | 'MEDIUM' | 'HIGH';

type RegistrationSuggestion = {
  id: string;
  fieldPath: string;
  fieldLabel: string;
  proposedValue: string;
  displayValue: string;
  rationale: string;
  confidence: number;
  verificationStatus: string;
  conflictGroup: string | null;
  sourceIds: string[];
  risk: RegistrationSuggestionRisk;
  safeToApply: boolean;
  requiresAdminReview: true;
};

type ModelSuggestion = {
  fieldPath?: unknown;
  fieldLabel?: unknown;
  proposedValue?: unknown;
  displayValue?: unknown;
  rationale?: unknown;
  confidence?: unknown;
  evidenceIds?: unknown;
  risk?: unknown;
};

type ModelMissingInformation = {
  fieldPath?: unknown;
  reason?: unknown;
  recommendedAction?: unknown;
};

type ModelConflict = {
  fieldPath?: unknown;
  evidenceIds?: unknown;
  description?: unknown;
};

const SECTION_FIELD_PATHS: Record<AdminProductAiRegistrationSection, string[]> =
  {
    [AdminProductAiRegistrationSection.IDENTITY]: [
      'product.name',
      'product.slug',
      'product.sku',
      'product.brandName',
      'product.categoryName',
      'product.productTypeName',
      'product.productModelName',
      'product.modelCode',
    ],
    [AdminProductAiRegistrationSection.ATTRIBUTES]: [
      'attribute.*',
      'attributes.*',
      'product.weight',
      'product.dimensions',
    ],
    [AdminProductAiRegistrationSection.VARIANTS]: [
      'variant.name',
      'variant.sku',
      'variant.barcode',
      'variant.gtin',
      'variant.mpn',
      'variant.slug',
    ],
    [AdminProductAiRegistrationSection.PRICING]: [
      'market.referencePrice',
      'market.priceCurrency',
      'market.availability',
      'pricing.referencePrice',
      'product.price',
      'product.comparePrice',
      'product.salePrice',
      'product.finalPrice',
    ],
    [AdminProductAiRegistrationSection.MEDIA]: [
      'product.primaryImageUrl',
      'media.altText',
      'media.title',
      'media.caption',
    ],
    [AdminProductAiRegistrationSection.SEO]: [
      'product.shortDescription',
      'product.description',
      'product.seoTitle',
      'product.seoDescription',
      'product.canonicalUrl',
      'product.schemaJson',
      'media.altText',
    ],
    [AdminProductAiRegistrationSection.AI]: [
      'product.name',
      'product.slug',
      'product.sku',
      'product.shortDescription',
      'product.description',
      'product.seoTitle',
      'product.seoDescription',
      'product.canonicalUrl',
      'product.schemaJson',
      'product.primaryImageUrl',
      'product.weight',
      'product.dimensions',
      'variant.name',
      'variant.sku',
      'variant.barcode',
      'variant.gtin',
      'variant.mpn',
      'variant.slug',
      'attribute.*',
      'attributes.*',
      'media.altText',
      'media.title',
      'media.caption',
      'market.referencePrice',
      'market.priceCurrency',
      'market.availability',
      'pricing.referencePrice',
    ],
  };

const FIELD_LABELS: Record<string, string> = {
  'product.name': 'نام رسمی محصول',
  'product.slug': 'Slug محصول',
  'product.sku': 'SKU پایه محصول',
  'product.brandName': 'نام برند',
  'product.categoryName': 'دسته‌بندی',
  'product.productTypeName': 'نوع محصول',
  'product.productModelName': 'مدل محصول',
  'product.modelCode': 'کد مدل',
  'product.shortDescription': 'توضیح کوتاه',
  'product.description': 'توضیحات کامل',
  'product.seoTitle': 'عنوان SEO',
  'product.seoDescription': 'توضیح SEO',
  'product.canonicalUrl': 'Canonical URL',
  'product.schemaJson': 'Structured Data',
  'product.primaryImageUrl': 'تصویر اصلی پیشنهادی',
  'product.weight': 'وزن محصول',
  'product.dimensions': 'ابعاد محصول',
  'product.price': 'قیمت پایه',
  'product.comparePrice': 'قیمت مقایسه‌ای',
  'product.salePrice': 'قیمت فروش',
  'product.finalPrice': 'قیمت نهایی',
  'variant.name': 'نام تنوع',
  'variant.sku': 'SKU تنوع',
  'variant.barcode': 'بارکد',
  'variant.gtin': 'GTIN',
  'variant.mpn': 'MPN',
  'variant.slug': 'Slug تنوع',
  'market.referencePrice': 'قیمت مرجع بازار',
  'market.priceCurrency': 'واحد پول منبع',
  'market.availability': 'وضعیت عرضه در بازار',
  'pricing.referencePrice': 'قیمت مرجع پیشنهادی',
  'media.altText': 'Alt تصویر',
  'media.title': 'عنوان تصویر',
  'media.caption': 'کپشن تصویر',
};

const SENSITIVE_FIELD_PREFIXES = [
  'market.',
  'pricing.',
  'product.price',
  'product.comparePrice',
  'product.salePrice',
  'product.finalPrice',
  'product.status',
  'product.isActive',
  'stock.',
  'inventory.',
];

const DIRECT_DRAFT_FIELD_PATHS = new Set([
  'product.name',
  'product.slug',
  'product.sku',
  'product.shortDescription',
  'product.description',
  'product.seoTitle',
  'product.seoDescription',
  'product.canonicalUrl',
  'product.schemaJson',
  'product.primaryImageUrl',
  'product.weight',
  'product.dimensions',
  'variant.name',
  'variant.sku',
  'variant.barcode',
  'variant.gtin',
  'variant.mpn',
  'variant.slug',
  'media.altText',
  'media.title',
  'media.caption',
]);

@Injectable()
export class AdminProductRegistrationAiService {
  private readonly logger = new Logger(AdminProductRegistrationAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminProductService: AdminProductService,
    private readonly knowledgeRetrieval: AiKnowledgeRetrievalService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: AiProvider,
  ) {}

  async generateAssistance(
    productId: string,
    dto: AdminProductAiRegistrationAssistDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(context);
    const product = await this.adminProductService.findOne(productId);
    const section = dto.section;
    const safeProduct = this.buildSafeProductContext(product);
    const safeDraft = this.sanitizeDraftContext(dto.currentDraft);
    const query = this.buildRetrievalQuery(
      section,
      safeProduct,
      dto.extraInstruction,
    );

    const evidence = await this.collectEvidence(productId, safeProduct, query);
    const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
    const deterministicSuggestions = this.buildEvidenceSuggestions(
      section,
      evidence,
      safeDraft,
    );

    let model: string | null = null;
    let runLogId: string | null = null;
    let fallbackUsed = false;
    let fallbackReason: string | null = null;
    let summary = this.buildDeterministicSummary(
      section,
      deterministicSuggestions,
      evidence,
    );
    let modelSuggestions: RegistrationSuggestion[] = [];
    let missingInformation: Array<{
      fieldPath: string;
      reason: string;
      recommendedAction: string;
    }> = [];
    let modelConflicts: Array<{
      fieldPath: string;
      sourceIds: string[];
      description: string;
    }> = [];

    try {
      const providerResult = await this.aiProvider.generate(
        this.buildMessages({
          section,
          safeProduct,
          safeDraft,
          evidence,
          extraInstruction: dto.extraInstruction,
        }),
        {
          task: this.resolveTask(section),
          temperature: 0.12,
          maxTokens: 2200,
          jsonSchema: this.buildOutputSchema(),
          userId: context.userId ?? undefined,
          promptKey: `product-registration-assist-${section}`,
          metadata: {
            actorId: context.userId ?? null,
            productId,
            section,
            evidenceCount: evidence.length,
            deterministicSuggestionCount: deterministicSuggestions.length,
          },
        },
      );

      model = providerResult.model;
      runLogId = providerResult.runLogId ?? null;
      fallbackUsed = providerResult.taskType === 'FALLBACK';
      fallbackReason = fallbackUsed
        ? 'مدل اصلی در دسترس نبود و مدل جایگزین محلی پاسخ را تولید کرد.'
        : null;

      const parsed = this.parseJsonObject(providerResult.content);
      summary = this.getString(parsed.summary)?.slice(0, 1200) || summary;
      modelSuggestions = this.normalizeModelSuggestions(
        section,
        parsed.suggestions,
        evidenceMap,
      );
      missingInformation = this.normalizeMissingInformation(
        parsed.missingInformation,
        section,
      );
      modelConflicts = this.normalizeModelConflicts(
        parsed.conflicts,
        section,
        evidenceMap,
      );
    } catch (error) {
      const internalReason = this.getErrorMessage(error);

      fallbackUsed = true;
      fallbackReason =
        'مدل تولیدی در این اجرا پاسخ معتبر نداد؛ فقط شواهد قطعی موجود نمایش داده شدند.';
      this.logger.warn(
        `Product registration assistance used deterministic fallback: ${internalReason}`,
      );
    }

    const suggestions = this.mergeSuggestions(
      deterministicSuggestions,
      modelSuggestions,
    );
    const conflicts = this.mergeConflicts(
      modelConflicts,
      this.buildEvidenceConflicts(section, evidence),
    );
    const usedSourceIds = new Set(
      suggestions.flatMap((suggestion) => suggestion.sourceIds),
    );
    const visibleEvidence = evidence
      .filter(
        (item) =>
          usedSourceIds.has(item.id) ||
          item.kind === 'APPROVED_KNOWLEDGE' ||
          item.conflictGroup !== null,
      )
      .slice(0, 28);

    return {
      productId,
      section,
      generatedAt: new Date().toISOString(),
      summary,
      suggestions,
      sources: visibleEvidence.map((item) => this.toPublicEvidence(item)),
      missingInformation,
      conflicts,
      research: this.buildResearchSummary(evidence),
      model,
      runLogId,
      fallbackUsed,
      fallbackReason,
      tool: this.toPublicTool(tool),
      safety: {
        persistencePerformed: false,
        appliesToDraftOnly: true,
        pricingAndStockAutoApplyBlocked: true,
        adminReviewRequired: true,
      },
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_registration_assistance_generated',
      },
    };
  }

  private async collectEvidence(
    productId: string,
    safeProduct: JsonRecord,
    query: string,
  ): Promise<RegistrationEvidence[]> {
    const now = new Date();
    const [approvedRows, suggestionRows, retrieved] = await Promise.all([
      this.prisma.catalogApprovedKnowledge.findMany({
        where: {
          productId,
          isCurrent: true,
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ confidence: 'desc' }, { approvedAt: 'desc' }],
        take: 100,
      }),
      this.prisma.catalogResearchFieldSuggestion.findMany({
        where: {
          productId,
          deletedAt: null,
          adminDecision: {
            in: ['PENDING', 'APPROVED'],
          },
          researchRun: {
            deletedAt: null,
          },
          OR: [
            {
              sourceId: null,
            },
            {
              source: {
                deletedAt: null,
              },
            },
          ],
        },
        include: {
          source: true,
          researchRun: true,
        },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: 140,
      }),
      this.knowledgeRetrieval.retrieve({
        query,
        productIds: [productId],
        limit: 10,
      }),
    ]);

    const result: RegistrationEvidence[] = [
      {
        id: 'product:current',
        kind: 'PRODUCT_CONTEXT',
        fieldPath: null,
        title: 'اطلاعات فعلی ثبت‌شده محصول',
        content: JSON.stringify(safeProduct).slice(0, 8000),
        displayValue: null,
        confidence: 0.78,
        sourceUrl: null,
        sourceTitle: null,
        sourceExcerpt: null,
        verificationStatus: 'INTERNAL_PRODUCT_DATA',
        conflictGroup: null,
        researchRunId: null,
        researchSuggestionId: null,
      },
      ...approvedRows.map((row) => ({
        id: `approved:${row.id}`,
        kind: 'APPROVED_KNOWLEDGE' as const,
        fieldPath: this.normalizeFieldPath(row.fieldPath),
        title: this.fieldLabel(this.normalizeFieldPath(row.fieldPath)),
        content: this.formatEvidenceContent(
          this.normalizeFieldPath(row.fieldPath),
          row.displayValue,
          row.normalizedValue,
          row.unit,
        ),
        displayValue:
          row.displayValue?.trim() || this.stringifyValue(row.normalizedValue),
        confidence: this.normalizeConfidence(row.confidence),
        sourceUrl: this.normalizeSourceUrl(
          this.toStringArray(row.sourceUrlsJson)[0],
        ),
        sourceTitle: 'دانش تأییدشده مدیر',
        sourceExcerpt: null,
        verificationStatus:
          this.getMetadataString(row.metadataJson, 'verificationStatus') ??
          'ADMIN_APPROVED',
        conflictGroup: null,
        researchRunId: this.getMetadataString(
          row.metadataJson,
          'researchRunId',
        ),
        researchSuggestionId: row.sourceSuggestionId,
      })),
      ...suggestionRows.map((row) => ({
        id: `suggestion:${row.id}`,
        kind: 'RESEARCH_SUGGESTION' as const,
        fieldPath: this.normalizeFieldPath(row.fieldPath),
        title: this.fieldLabel(this.normalizeFieldPath(row.fieldPath)),
        content: this.formatEvidenceContent(
          this.normalizeFieldPath(row.fieldPath),
          row.displayValue,
          row.normalizedValue,
          row.unit,
        ),
        displayValue:
          row.displayValue?.trim() || this.stringifyValue(row.normalizedValue),
        confidence: this.normalizeConfidence(row.confidence),
        sourceUrl: this.normalizeSourceUrl(row.source?.sourceUrl),
        sourceTitle: row.source?.title ?? row.source?.domain ?? null,
        sourceExcerpt: row.sourceExcerpt,
        verificationStatus:
          row.adminDecision === 'APPROVED' &&
          ![
            'EXACT_OFFICIAL_PRODUCT_PAGE',
            'OFFICIAL_MEDIA_IMPORT_REQUIRED',
          ].includes(row.verificationStatus)
            ? 'ADMIN_APPROVED'
            : row.verificationStatus,
        conflictGroup: row.conflictGroup,
        researchRunId: row.researchRunId,
        researchSuggestionId: row.id,
      })),
      ...retrieved.map((item) => this.mapRetrievedEvidence(item)),
    ];

    return this.deduplicateEvidence(result).slice(0, 180);
  }

  private mapRetrievedEvidence(
    item: AiGroundingEvidence,
  ): RegistrationEvidence {
    return {
      id: `retrieved:${item.kind}:${item.id}`,
      kind:
        item.kind === 'APPROVED_PRODUCT_KNOWLEDGE'
          ? 'APPROVED_KNOWLEDGE'
          : 'ADMIN_KNOWLEDGE',
      fieldPath:
        item.kind === 'APPROVED_PRODUCT_KNOWLEDGE'
          ? this.normalizeFieldPath(item.title)
          : null,
      title: item.title,
      content: item.content,
      displayValue: item.content,
      confidence: this.normalizeConfidence(
        item.confidence ?? item.relevanceScore,
      ),
      sourceUrl: this.normalizeSourceUrl(item.sourceUrls[0]),
      sourceTitle: item.title,
      sourceExcerpt: item.content.slice(0, 600),
      verificationStatus:
        item.kind === 'APPROVED_PRODUCT_KNOWLEDGE'
          ? 'ADMIN_APPROVED'
          : 'ADMIN_KNOWLEDGE',
      conflictGroup: null,
      researchRunId: null,
      researchSuggestionId: null,
    };
  }

  private buildEvidenceSuggestions(
    section: AdminProductAiRegistrationSection,
    evidence: RegistrationEvidence[],
    safeDraft: JsonRecord,
  ): RegistrationSuggestion[] {
    const suggestions: RegistrationSuggestion[] = [];

    for (const item of evidence) {
      if (!item.fieldPath || !this.fieldAllowed(section, item.fieldPath)) {
        continue;
      }

      if (!this.evidenceEligibleForField(item.fieldPath, [item])) {
        continue;
      }

      if (!['APPROVED_KNOWLEDGE', 'RESEARCH_SUGGESTION'].includes(item.kind)) {
        continue;
      }

      const proposedValue = item.displayValue?.trim();

      if (!proposedValue || proposedValue.length > 12000) {
        continue;
      }

      if (this.currentDraftMatches(safeDraft, item.fieldPath, proposedValue)) {
        continue;
      }

      suggestions.push(
        this.createSuggestion({
          section,
          fieldPath: item.fieldPath,
          fieldLabel: this.fieldLabel(item.fieldPath),
          proposedValue,
          displayValue: proposedValue,
          rationale:
            item.kind === 'APPROVED_KNOWLEDGE'
              ? 'این مقدار قبلاً با بررسی مدیر به‌عنوان دانش جاری محصول تأیید شده است.'
              : 'این مقدار از پرونده تحقیق محصول و منبع قابل ردیابی استخراج شده است.',
          confidence: item.confidence,
          verificationStatus: item.verificationStatus,
          conflictGroup: item.conflictGroup,
          sourceIds: [item.id],
        }),
      );
    }

    return this.deduplicateSuggestions(suggestions).slice(0, 12);
  }

  private buildMessages(input: {
    section: AdminProductAiRegistrationSection;
    safeProduct: JsonRecord;
    safeDraft: JsonRecord;
    evidence: RegistrationEvidence[];
    extraInstruction?: string;
  }) {
    const allowedFieldPaths = SECTION_FIELD_PATHS[input.section];
    const evidence = input.evidence.slice(0, 36).map((item) => ({
      id: item.id,
      kind: item.kind,
      fieldPath: item.fieldPath,
      title: item.title,
      content: item.content.slice(0, 900),
      confidence: Number(item.confidence.toFixed(4)),
      sourceUrl: item.sourceUrl,
      verificationStatus: item.verificationStatus,
      conflictGroup: item.conflictGroup,
    }));

    return [
      {
        role: 'system' as const,
        content: [
          'شما دستیار حرفه‌ای و کنترل‌شده ثبت کالای فروشگاه VEXO Beauty هستید.',
          'فقط بر اساس اطلاعات فعلی محصول و evidenceهای ارسال‌شده پیشنهاد بدهید.',
          'هیچ منبع، شناسه، ویژگی، قیمت، ادعا یا مشخصه‌ای را حدس نزنید.',
          'evidenceIds فقط باید از شناسه‌های موجود در evidence انتخاب شوند.',
          'برای داده متعارض، conflict را گزارش کنید و confidence را کاهش دهید.',
          'قیمت، موجودی، وضعیت انتشار، شناسه‌های یکتا و داده حساس هرگز نباید خودکار اعمال شوند.',
          'خروجی فقط JSON مطابق schema باشد و هیچ Markdown یا توضیح خارج از JSON نداشته باشد.',
          'تمام پیشنهادها نیازمند بررسی مدیر هستند.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          task: 'PRODUCT_REGISTRATION_ASSISTANCE',
          language: 'fa',
          section: input.section,
          allowedFieldPaths,
          extraInstruction: input.extraInstruction ?? null,
          product: input.safeProduct,
          currentDraft: input.safeDraft,
          evidence,
          outputRules: {
            maximumSuggestions: 12,
            maximumMissingInformation: 10,
            maximumConflicts: 10,
            proposedValueMustBeString: true,
            noEvidenceMeansNoSuggestion: true,
            pricingNeedsExternalEvidence: true,
            adminReviewRequired: true,
          },
        }),
      },
    ];
  }

  private buildOutputSchema(): JsonRecord {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'suggestions', 'missingInformation', 'conflicts'],
      properties: {
        summary: {
          type: 'string',
          maxLength: 1200,
        },
        suggestions: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'fieldPath',
              'fieldLabel',
              'proposedValue',
              'displayValue',
              'rationale',
              'confidence',
              'evidenceIds',
              'risk',
            ],
            properties: {
              fieldPath: {
                type: 'string',
                maxLength: 160,
              },
              fieldLabel: {
                type: 'string',
                maxLength: 160,
              },
              proposedValue: {
                type: 'string',
                maxLength: 12000,
              },
              displayValue: {
                type: 'string',
                maxLength: 12000,
              },
              rationale: {
                type: 'string',
                maxLength: 1200,
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
              },
              evidenceIds: {
                type: 'array',
                maxItems: 8,
                items: {
                  type: 'string',
                  maxLength: 220,
                },
              },
              risk: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH'],
              },
            },
          },
        },
        missingInformation: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['fieldPath', 'reason', 'recommendedAction'],
            properties: {
              fieldPath: {
                type: 'string',
                maxLength: 160,
              },
              reason: {
                type: 'string',
                maxLength: 800,
              },
              recommendedAction: {
                type: 'string',
                maxLength: 800,
              },
            },
          },
        },
        conflicts: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['fieldPath', 'evidenceIds', 'description'],
            properties: {
              fieldPath: {
                type: 'string',
                maxLength: 160,
              },
              evidenceIds: {
                type: 'array',
                maxItems: 8,
                items: {
                  type: 'string',
                  maxLength: 220,
                },
              },
              description: {
                type: 'string',
                maxLength: 1000,
              },
            },
          },
        },
      },
    };
  }

  private normalizeModelSuggestions(
    section: AdminProductAiRegistrationSection,
    value: unknown,
    evidenceMap: Map<string, RegistrationEvidence>,
  ): RegistrationSuggestion[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const result: RegistrationSuggestion[] = [];

    for (const item of value.slice(0, 20)) {
      const record = this.toRecord(item) as ModelSuggestion;
      const fieldPath = this.getString(record.fieldPath);
      const proposedValue = this.getString(record.proposedValue);

      if (
        !fieldPath ||
        !proposedValue ||
        !this.fieldAllowed(section, fieldPath)
      ) {
        continue;
      }

      const evidenceIds = this.toStringArray(record.evidenceIds)
        .filter((id) => evidenceMap.has(id))
        .slice(0, 8);

      if (evidenceIds.length === 0) {
        continue;
      }

      const selectedEvidence = evidenceIds
        .map((id) => evidenceMap.get(id))
        .filter((item): item is RegistrationEvidence => Boolean(item));

      if (
        this.isSensitiveField(fieldPath) &&
        !selectedEvidence.some((item) => item.sourceUrl)
      ) {
        continue;
      }

      if (!this.evidenceEligibleForField(fieldPath, selectedEvidence)) {
        continue;
      }

      const maximumEvidenceConfidence = Math.max(
        0.5,
        ...selectedEvidence.map((item) => item.confidence),
      );
      const requestedConfidence = this.normalizeConfidence(record.confidence);
      const confidence = Math.min(
        requestedConfidence || maximumEvidenceConfidence,
        Math.min(0.98, maximumEvidenceConfidence + 0.05),
      );
      const conflictGroup =
        selectedEvidence.find((item) => item.conflictGroup)?.conflictGroup ??
        null;
      const verificationStatus =
        this.resolveVerificationStatus(selectedEvidence);

      result.push(
        this.createSuggestion({
          section,
          fieldPath,
          fieldLabel:
            this.getString(record.fieldLabel) || this.fieldLabel(fieldPath),
          proposedValue: proposedValue.slice(0, 12000),
          displayValue: (
            this.getString(record.displayValue) || proposedValue
          ).slice(0, 12000),
          rationale: (
            this.getString(record.rationale) ||
            'این پیشنهاد از شواهد ثبت‌شده محصول استخراج و با مدل محلی بازنویسی شده است.'
          ).slice(0, 1200),
          confidence,
          verificationStatus,
          conflictGroup,
          sourceIds: evidenceIds,
          requestedRisk: this.normalizeRisk(record.risk),
        }),
      );
    }

    return this.deduplicateSuggestions(result).slice(0, 12);
  }

  private normalizeMissingInformation(
    value: unknown,
    section: AdminProductAiRegistrationSection,
  ) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .slice(0, 10)
      .map((item) => this.toRecord(item) as ModelMissingInformation)
      .map((item) => ({
        fieldPath: this.getString(item.fieldPath)?.slice(0, 160) ?? '',
        reason: this.getString(item.reason)?.slice(0, 800) ?? '',
        recommendedAction:
          this.getString(item.recommendedAction)?.slice(0, 800) ?? '',
      }))
      .filter(
        (item) =>
          item.fieldPath &&
          item.reason &&
          this.fieldAllowed(section, item.fieldPath),
      );
  }

  private normalizeModelConflicts(
    value: unknown,
    section: AdminProductAiRegistrationSection,
    evidenceMap: Map<string, RegistrationEvidence>,
  ) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .slice(0, 10)
      .map((item) => this.toRecord(item) as ModelConflict)
      .map((item) => ({
        fieldPath: this.getString(item.fieldPath)?.slice(0, 160) ?? '',
        sourceIds: this.toStringArray(item.evidenceIds)
          .filter((id) => evidenceMap.has(id))
          .slice(0, 8),
        description: this.getString(item.description)?.slice(0, 1000) ?? '',
      }))
      .filter(
        (item) =>
          item.fieldPath &&
          item.description &&
          item.sourceIds.length > 0 &&
          this.fieldAllowed(section, item.fieldPath),
      );
  }

  private buildEvidenceConflicts(
    section: AdminProductAiRegistrationSection,
    evidence: RegistrationEvidence[],
  ) {
    const groups = new Map<string, RegistrationEvidence[]>();

    for (const item of evidence) {
      if (
        !item.fieldPath ||
        !item.conflictGroup ||
        !this.fieldAllowed(section, item.fieldPath)
      ) {
        continue;
      }

      const key = `${item.fieldPath}:${item.conflictGroup}`;
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }

    return [...groups.values()].slice(0, 10).map((items) => ({
      fieldPath: items[0]?.fieldPath ?? '',
      sourceIds: items.map((item) => item.id).slice(0, 8),
      description:
        'برای این فیلد چند مقدار ناسازگار در منابع ثبت شده است؛ پیش از اعمال، منبع رسمی و شناسه دقیق محصول را بررسی کنید.',
    }));
  }

  private mergeConflicts(
    first: Array<{
      fieldPath: string;
      sourceIds: string[];
      description: string;
    }>,
    second: Array<{
      fieldPath: string;
      sourceIds: string[];
      description: string;
    }>,
  ) {
    const seen = new Set<string>();

    return [...first, ...second]
      .filter((item) => {
        const key = `${item.fieldPath}:${[...item.sourceIds].sort().join(',')}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }

  private mergeSuggestions(
    deterministic: RegistrationSuggestion[],
    generated: RegistrationSuggestion[],
  ): RegistrationSuggestion[] {
    const result: RegistrationSuggestion[] = [];
    const fieldCounts = new Map<string, number>();
    const seen = new Set<string>();

    for (const item of [...deterministic, ...generated]) {
      const key = `${item.fieldPath}:${item.proposedValue.trim().toLowerCase()}`;
      const count = fieldCounts.get(item.fieldPath) ?? 0;

      if (seen.has(key) || count >= 2) {
        continue;
      }

      seen.add(key);
      fieldCounts.set(item.fieldPath, count + 1);
      result.push(item);

      if (result.length >= 12) {
        break;
      }
    }

    return result;
  }

  private createSuggestion(input: {
    section: AdminProductAiRegistrationSection;
    fieldPath: string;
    fieldLabel: string;
    proposedValue: string;
    displayValue: string;
    rationale: string;
    confidence: number;
    verificationStatus: string;
    conflictGroup: string | null;
    sourceIds: string[];
    requestedRisk?: RegistrationSuggestionRisk;
  }): RegistrationSuggestion {
    const risk = this.resolveRisk(input.fieldPath, input.requestedRisk);
    const requiresExactOfficialPage =
      input.fieldPath === 'product.canonicalUrl';
    const requiresMediaImport = input.fieldPath === 'product.primaryImageUrl';
    const safeToApply =
      this.isDraftApplicableField(input.fieldPath) &&
      !this.isSensitiveField(input.fieldPath) &&
      input.verificationStatus !== 'CONFLICT' &&
      input.conflictGroup === null &&
      input.sourceIds.length > 0 &&
      this.isDraftApplicableValue(input.fieldPath, input.proposedValue) &&
      input.confidence >= 0.62 &&
      (!requiresExactOfficialPage ||
        input.verificationStatus === 'EXACT_OFFICIAL_PRODUCT_PAGE') &&
      !requiresMediaImport;
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          section: input.section,
          fieldPath: input.fieldPath,
          proposedValue: input.proposedValue,
          sourceIds: input.sourceIds,
        }),
      )
      .digest('hex')
      .slice(0, 18);

    return {
      id: `assist-${digest}`,
      fieldPath: input.fieldPath,
      fieldLabel: input.fieldLabel,
      proposedValue: input.proposedValue,
      displayValue: input.displayValue,
      rationale: input.rationale,
      confidence: Number(this.clamp01(input.confidence).toFixed(4)),
      verificationStatus: input.verificationStatus,
      conflictGroup: input.conflictGroup,
      sourceIds: [...new Set(input.sourceIds)].slice(0, 8),
      risk,
      safeToApply,
      requiresAdminReview: true,
    };
  }

  private buildSafeProductContext(productInput: unknown): JsonRecord {
    const product = this.toRecord(productInput);
    const brand = this.toRecord(product.brand);
    const category = this.toRecord(product.category);
    const productType = this.toRecord(product.productType);
    const productModel = this.toRecord(product.productModel);
    const seo = this.toRecord(product.seo);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const images = Array.isArray(product.images) ? product.images : [];
    const attributes = Array.isArray(product.attributes)
      ? product.attributes
      : [];

    return {
      id: this.getString(product.id),
      name: this.getString(product.name),
      slug: this.getString(product.slug),
      sku: this.getString(product.sku),
      status: this.getString(product.status),
      isActive: product.isActive === true,
      brand: {
        id: this.getString(brand.id),
        name: this.getString(brand.name) ?? this.getString(product.brandName),
      },
      category: {
        id: this.getString(category.id),
        name:
          this.getString(category.name) ?? this.getString(product.categoryName),
      },
      productType: {
        id: this.getString(productType.id),
        name:
          this.getString(productType.name) ??
          this.getString(product.productTypeName),
      },
      productModel: {
        id: this.getString(productModel.id),
        name:
          this.getString(productModel.name) ??
          this.getString(product.productModelName),
        modelCode:
          this.getString(productModel.modelCode) ??
          this.getString(product.productModelCode),
      },
      shortDescription: this.getString(product.shortDescription),
      description: this.getString(product.description),
      publicPricing: {
        price: this.getSafeNumericText(product.price),
        comparePrice: this.getSafeNumericText(product.comparePrice),
        salePrice: this.getSafeNumericText(pricing.salePrice),
        finalPrice: this.getSafeNumericText(pricing.finalPrice),
        discountPercent: this.getSafeNumericText(pricing.discountPercent),
      },
      weight: product.weight ?? null,
      dimensions: this.sanitizeValue(product.dimensions, 0),
      seo: {
        title: this.getString(product.seoTitle) ?? this.getString(seo.title),
        description:
          this.getString(product.seoDescription) ??
          this.getString(seo.description),
        canonicalUrl:
          this.getString(product.canonicalUrl) ??
          this.getString(seo.canonicalUrl),
        schemaJson: this.sanitizeValue(product.schemaJson ?? seo.schemaJson, 0),
      },
      stock: {
        variantCount: stock.variantCount ?? null,
        warehouseCount: stock.warehouseCount ?? null,
        availableStock: stock.availableStock ?? null,
        isLowStock: stock.isLowStock === true,
        isOutOfStock: stock.isOutOfStock === true,
      },
      images: images.slice(0, 12).map((item) => {
        const image = this.toRecord(item);

        return {
          id: this.getString(image.id),
          url: this.getString(image.url),
          altText: this.getString(image.altText),
          title: this.getString(image.title),
          caption: this.getString(image.caption),
          isPrimary: image.isPrimary === true,
        };
      }),
      attributes: attributes.slice(0, 80).map((item) => {
        const attribute = this.toRecord(item);

        return {
          attributeId: this.getString(attribute.attributeId),
          code: this.getString(attribute.code),
          label: this.getString(attribute.label),
          valueText: this.getString(attribute.valueText),
          valueNumber: this.getSafeNumericText(attribute.valueNumber),
          valueBoolean:
            typeof attribute.valueBoolean === 'boolean'
              ? attribute.valueBoolean
              : null,
          valueJson: this.sanitizeValue(attribute.valueJson, 0),
          unit: this.getString(attribute.unit),
        };
      }),
    };
  }

  private sanitizeDraftContext(value: unknown): JsonRecord {
    const sanitized = this.sanitizeValue(value, 0);

    return this.toRecord(sanitized);
  }

  private sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > 4 || value === null || value === undefined) {
      return value ?? null;
    }

    if (typeof value === 'string') {
      return value.slice(0, 4000);
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 40)
        .map((item) => this.sanitizeValue(item, depth + 1));
    }

    if (!this.isRecord(value)) {
      return null;
    }

    const result: JsonRecord = {};

    for (const [key, item] of Object.entries(value).slice(0, 120)) {
      if (this.isSensitiveContextKey(key)) {
        continue;
      }

      result[key] = this.sanitizeValue(item, depth + 1);
    }

    return result;
  }

  private isSensitiveContextKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

    return [
      'purchaseprice',
      'minallowedprice',
      'grossmarginamount',
      'grossmarginpercent',
      'reservedquantity',
      'password',
      'secret',
      'token',
      'authorization',
      'approvalreason',
      'aiprompt',
      'systemprompt',
    ].some((forbidden) => normalized.includes(forbidden));
  }

  private buildRetrievalQuery(
    section: AdminProductAiRegistrationSection,
    safeProduct: JsonRecord,
    extraInstruction?: string,
  ): string {
    const brand = this.toRecord(safeProduct.brand);
    const model = this.toRecord(safeProduct.productModel);
    const parts = [
      this.getString(safeProduct.name),
      this.getString(safeProduct.sku),
      this.getString(brand.name),
      this.getString(model.name),
      this.getString(model.modelCode),
      this.sectionLabel(section),
      extraInstruction,
    ];

    return parts
      .filter((item): item is string => Boolean(item?.trim()))
      .join(' | ');
  }

  private currentDraftMatches(
    draft: JsonRecord,
    fieldPath: string,
    proposedValue: string,
  ): boolean {
    const map: Record<string, string> = {
      'product.name': 'name',
      'product.slug': 'slug',
      'product.sku': 'sku',
      'product.shortDescription': 'shortDescription',
      'product.description': 'description',
      'product.seoTitle': 'seoTitle',
      'product.seoDescription': 'seoDescription',
      'product.canonicalUrl': 'canonicalUrl',
      'product.schemaJson': 'schemaJsonText',
      'product.primaryImageUrl': 'mediaUrl',
      'media.altText': 'mediaAlt',
      'media.title': 'mediaTitle',
      'media.caption': 'mediaCaption',
    };
    const key = map[fieldPath];

    if (!key) {
      return false;
    }

    const current = this.getString(draft[key]);

    return current?.trim().toLowerCase() === proposedValue.trim().toLowerCase();
  }

  private normalizeFieldPath(fieldPath: string): string {
    const normalized = fieldPath.trim();

    if (normalized.startsWith('research.attribute.')) {
      return `attribute.${normalized.slice('research.attribute.'.length)}`;
    }

    return normalized;
  }

  private normalizeSourceUrl(value: unknown): string | null {
    const raw = this.getString(value);

    if (!raw) {
      return null;
    }

    try {
      const url = new URL(raw);

      return url.protocol === 'http:' || url.protocol === 'https:'
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private isDraftApplicableValue(
    fieldPath: string,
    proposedValue: string,
  ): boolean {
    if (
      fieldPath === 'product.canonicalUrl' ||
      fieldPath === 'product.primaryImageUrl'
    ) {
      return this.normalizeSourceUrl(proposedValue) !== null;
    }

    if (
      fieldPath === 'product.schemaJson' ||
      fieldPath === 'product.dimensions' ||
      fieldPath.startsWith('attribute.') ||
      fieldPath.startsWith('attributes.')
    ) {
      if (
        fieldPath === 'product.schemaJson' ||
        fieldPath === 'product.dimensions'
      ) {
        try {
          JSON.parse(proposedValue);
        } catch {
          return false;
        }
      }
    }

    return proposedValue.trim().length > 0;
  }

  private evidenceEligibleForField(
    fieldPath: string,
    evidence: RegistrationEvidence[],
  ): boolean {
    if (fieldPath === 'product.canonicalUrl') {
      return evidence.some(
        (item) => item.verificationStatus === 'EXACT_OFFICIAL_PRODUCT_PAGE',
      );
    }

    if (fieldPath === 'product.primaryImageUrl') {
      return evidence.some(
        (item) => item.verificationStatus === 'OFFICIAL_MEDIA_IMPORT_REQUIRED',
      );
    }

    return true;
  }

  private fieldAllowed(
    section: AdminProductAiRegistrationSection,
    fieldPath: string,
  ): boolean {
    return SECTION_FIELD_PATHS[section].some((allowed) => {
      if (allowed.endsWith('.*')) {
        return fieldPath.startsWith(allowed.slice(0, -1));
      }

      return fieldPath === allowed;
    });
  }

  private fieldLabel(fieldPath: string): string {
    if (FIELD_LABELS[fieldPath]) {
      return FIELD_LABELS[fieldPath];
    }

    if (
      fieldPath.startsWith('attribute.') ||
      fieldPath.startsWith('attributes.')
    ) {
      return `ویژگی ${fieldPath.split('.').slice(1).join('.')}`;
    }

    return fieldPath;
  }

  private sectionLabel(section: AdminProductAiRegistrationSection): string {
    const labels: Record<AdminProductAiRegistrationSection, string> = {
      [AdminProductAiRegistrationSection.IDENTITY]: 'هویت و مسیر کالا',
      [AdminProductAiRegistrationSection.ATTRIBUTES]: 'مشخصات اختصاصی',
      [AdminProductAiRegistrationSection.VARIANTS]: 'تنوع‌ها و شناسه‌ها',
      [AdminProductAiRegistrationSection.PRICING]: 'قیمت و موجودی',
      [AdminProductAiRegistrationSection.MEDIA]: 'تصاویر و رسانه',
      [AdminProductAiRegistrationSection.SEO]: 'محتوا و سئو',
      [AdminProductAiRegistrationSection.AI]: 'بازبینی کامل هوشمند',
    };

    return labels[section];
  }

  private resolveTask(
    section: AdminProductAiRegistrationSection,
  ): AiCanonicalTaskType {
    if (section === AdminProductAiRegistrationSection.SEO) {
      return 'SEO';
    }

    if (section === AdminProductAiRegistrationSection.MEDIA) {
      return 'ALT_TEXT';
    }

    if (section === AdminProductAiRegistrationSection.PRICING) {
      return 'ANALYTICS';
    }

    return 'CONSULTING';
  }

  private resolveRisk(
    fieldPath: string,
    requested?: RegistrationSuggestionRisk,
  ): RegistrationSuggestionRisk {
    if (this.isSensitiveField(fieldPath)) {
      return 'HIGH';
    }

    if (
      fieldPath.startsWith('variant.') ||
      fieldPath === 'product.canonicalUrl' ||
      fieldPath === 'product.schemaJson' ||
      fieldPath === 'product.primaryImageUrl'
    ) {
      return 'MEDIUM';
    }

    return requested ?? 'LOW';
  }

  private normalizeRisk(value: unknown): RegistrationSuggestionRisk {
    return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW'
      ? value
      : 'LOW';
  }

  private isDraftApplicableField(fieldPath: string): boolean {
    return (
      DIRECT_DRAFT_FIELD_PATHS.has(fieldPath) ||
      fieldPath.startsWith('attribute.') ||
      fieldPath.startsWith('attributes.')
    );
  }

  private isSensitiveField(fieldPath: string): boolean {
    return SENSITIVE_FIELD_PREFIXES.some((prefix) =>
      fieldPath.startsWith(prefix),
    );
  }

  private resolveVerificationStatus(evidence: RegistrationEvidence[]): string {
    if (evidence.some((item) => item.conflictGroup)) {
      return 'CONFLICT';
    }

    if (
      evidence.some(
        (item) => item.verificationStatus === 'EXACT_OFFICIAL_PRODUCT_PAGE',
      )
    ) {
      return 'EXACT_OFFICIAL_PRODUCT_PAGE';
    }

    if (
      evidence.some(
        (item) => item.verificationStatus === 'OFFICIAL_MEDIA_IMPORT_REQUIRED',
      )
    ) {
      return 'OFFICIAL_MEDIA_IMPORT_REQUIRED';
    }

    if (
      evidence.some(
        (item) =>
          item.kind === 'APPROVED_KNOWLEDGE' ||
          item.verificationStatus === 'ADMIN_APPROVED',
      )
    ) {
      return 'ADMIN_APPROVED';
    }

    if (evidence.some((item) => item.sourceUrl)) {
      return 'SOURCE_REVIEW_REQUIRED';
    }

    return 'INTERNAL_PRODUCT_DATA';
  }

  private buildDeterministicSummary(
    section: AdminProductAiRegistrationSection,
    suggestions: RegistrationSuggestion[],
    evidence: RegistrationEvidence[],
  ): string {
    if (suggestions.length > 0) {
      return `برای بخش «${this.sectionLabel(section)}» ${suggestions.length.toLocaleString('fa-IR')} پیشنهاد مبتنی بر دانش تأییدشده یا پرونده تحقیق آماده شده است.`;
    }

    if (evidence.some((item) => item.sourceUrl)) {
      return `منابع قابل ردیابی برای بخش «${this.sectionLabel(section)}» وجود دارد، اما مقدار قطعی و قابل اعمال بدون بررسی بیشتر پیدا نشد.`;
    }

    return `برای بخش «${this.sectionLabel(section)}» هنوز شواهد رسمی کافی وجود ندارد؛ ابتدا پرونده تحقیق محصول را تکمیل کنید.`;
  }

  private buildResearchSummary(evidence: RegistrationEvidence[]) {
    return {
      approvedKnowledgeCount: evidence.filter(
        (item) => item.kind === 'APPROVED_KNOWLEDGE',
      ).length,
      pendingResearchSuggestionCount: evidence.filter(
        (item) =>
          item.kind === 'RESEARCH_SUGGESTION' &&
          item.verificationStatus !== 'ADMIN_APPROVED',
      ).length,
      sourceBackedEvidenceCount: evidence.filter((item) => item.sourceUrl)
        .length,
      conflictEvidenceCount: evidence.filter(
        (item) => item.conflictGroup !== null,
      ).length,
    };
  }

  private toPublicEvidence(item: RegistrationEvidence) {
    return {
      id: item.id,
      kind: item.kind,
      fieldPath: item.fieldPath,
      title: item.title,
      content: item.content.slice(0, 1400),
      displayValue: item.displayValue,
      confidence: Number(item.confidence.toFixed(4)),
      sourceUrl: item.sourceUrl,
      sourceTitle: item.sourceTitle,
      sourceExcerpt: item.sourceExcerpt?.slice(0, 900) ?? null,
      verificationStatus: item.verificationStatus,
      conflictGroup: item.conflictGroup,
      researchRunId: item.researchRunId,
      researchSuggestionId: item.researchSuggestionId,
    };
  }

  private formatEvidenceContent(
    fieldPath: string,
    displayValue: string | null,
    normalizedValue: unknown,
    unit: string | null,
  ): string {
    const value =
      displayValue?.trim() || this.stringifyValue(normalizedValue).trim();
    const suffix = unit?.trim() ? ` ${unit.trim()}` : '';

    return `${fieldPath}: ${value}${suffix}`.slice(0, 2000);
  }

  private deduplicateEvidence(
    evidence: RegistrationEvidence[],
  ): RegistrationEvidence[] {
    const seen = new Set<string>();
    const result: RegistrationEvidence[] = [];

    for (const item of evidence) {
      const key = [
        item.kind,
        item.fieldPath ?? '',
        item.content.trim().toLowerCase(),
        item.sourceUrl ?? '',
      ].join('|');

      if (!item.content.trim() || seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(item);
    }

    return result;
  }

  private deduplicateSuggestions(
    suggestions: RegistrationSuggestion[],
  ): RegistrationSuggestion[] {
    const seen = new Set<string>();

    return suggestions.filter((item) => {
      const key = `${item.fieldPath}:${item.proposedValue
        .trim()
        .toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private parseJsonObject(value: string): JsonRecord {
    const parsed: unknown = JSON.parse(value);

    if (!this.isRecord(parsed)) {
      throw new Error('Structured AI output root must be an object.');
    }

    return parsed;
  }

  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private getMetadataString(value: unknown, key: string): string | null {
    return this.getString(this.toRecord(value)[key]) ?? null;
  }

  private getSafeNumericText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'object') {
      try {
        const serialized = JSON.stringify(value);

        if (typeof serialized !== 'string') {
          return null;
        }

        return serialized.replace(/^"|"$/g, '').trim() || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private normalizeConfidence(value: unknown): number {
    const parsed = this.toNumber(value);

    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return this.clamp01(parsed > 1 ? parsed / 100 : parsed);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      return Number(value.trim().replace(/,/g, ''));
    }

    if (value && typeof value === 'object') {
      try {
        const serialized = JSON.stringify(value);

        if (typeof serialized !== 'string') {
          return Number.NaN;
        }

        return Number(serialized.replace(/^"|"$/g, ''));
      } catch {
        return Number.NaN;
      }
    }

    return Number.NaN;
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private getString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed || undefined;
  }

  private toRecord(value: unknown): JsonRecord {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private assertToolAccess(context: AiPermissionContext): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(
      'product.registration.assist',
    );

    this.permissionGuard.assertAuthenticated(context);
    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      'تحلیل هوشمند مرحله ثبت محصول',
    );

    return tool;
  }

  private toPublicTool(tool: AiToolDefinition) {
    return {
      name: tool.name,
      title: tool.title,
      riskLevel: tool.riskLevel,
      executionMode: tool.executionMode,
      requiresApproval: tool.requiresApproval,
    };
  }
}
