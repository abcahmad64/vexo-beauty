import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AiHybridRetrievalService,
  AiRetrievalDocument,
} from './ai-hybrid-retrieval.service';

type ApprovedKnowledgeRow = {
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

type KnowledgeDocumentRow = {
  id: string;
  key: string;
  title: string;
  content: string;
  sourceType: string;
  language: string;
  tagsJson: unknown;
  updatedAt: Date;
};

export type AiGroundingEvidence = {
  id: string;
  kind: 'APPROVED_PRODUCT_KNOWLEDGE' | 'ADMIN_KNOWLEDGE_DOCUMENT';
  productId: string | null;
  title: string;
  content: string;
  confidence: number | null;
  sourceUrls: string[];
  relevanceScore: number;
};

@Injectable()
export class AiKnowledgeRetrievalService {
  private readonly logger = new Logger(AiKnowledgeRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hybridRetrieval: AiHybridRetrievalService,
  ) {}

  async retrieve(input: {
    query: string;
    productIds: string[];
    limit?: number;
  }): Promise<AiGroundingEvidence[]> {
    try {
      const [approvedRows, knowledgeRows] = await Promise.all([
        this.findApprovedKnowledge(input.productIds),
        this.findKnowledgeDocuments(),
      ]);

      const documents: Array<AiRetrievalDocument<AiGroundingEvidence>> = [
        ...approvedRows.map((row) => this.mapApprovedKnowledge(row)),
        ...knowledgeRows.map((row) => this.mapKnowledgeDocument(row)),
      ];

      if (documents.length === 0) {
        return [];
      }

      const ranked = await this.hybridRetrieval.rank({
        query: input.query,
        documents,
        limit: Math.min(input.limit ?? 8, 12),
        instruction:
          'برای پاسخ دقیق فروشگاه، مرتبط‌ترین دانش تأییدشده محصول و سند مدیریتی را انتخاب کن.',
      });

      return this.applyContextBudget(
        ranked.map((item) => ({
          ...item.payload,
          relevanceScore: item.finalScore,
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Knowledge retrieval failed safely: ${this.getErrorMessage(error)}`,
      );

      return [];
    }
  }

  private findApprovedKnowledge(
    productIds: string[],
  ): Promise<ApprovedKnowledgeRow[]> {
    if (productIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.$queryRaw<ApprovedKnowledgeRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "productId",
          "fieldPath",
          "normalizedValue",
          "displayValue",
          "unit",
          "confidence",
          "sourceUrlsJson",
          "approvedAt",
          "updatedAt"
        FROM "CatalogApprovedKnowledge"
        WHERE
          "deleted_at" IS NULL
          AND "isCurrent" = TRUE
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND "productId" IN (${Prisma.join(productIds)})
        ORDER BY
          "confidence" DESC,
          "approvedAt" DESC
        LIMIT 160
      `,
    );
  }

  private findKnowledgeDocuments(): Promise<KnowledgeDocumentRow[]> {
    return this.prisma.$queryRaw<KnowledgeDocumentRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "key",
          "title",
          "content",
          "sourceType",
          "language",
          "tagsJson",
          "updatedAt"
        FROM "AiKnowledgeDocument"
        WHERE
          "deleted_at" IS NULL
          AND "status" = 'ACTIVE'
          AND "language" IN ('fa', 'en')
        ORDER BY "updatedAt" DESC
        LIMIT 120
      `,
    );
  }

  private mapApprovedKnowledge(
    row: ApprovedKnowledgeRow,
  ): AiRetrievalDocument<AiGroundingEvidence> {
    const value =
      row.displayValue?.trim() || this.stringifyValue(row.normalizedValue);
    const unit = row.unit?.trim() ? ` ${row.unit.trim()}` : '';
    const content = `${row.fieldPath}: ${value}${unit}`.trim();

    return {
      id: `approved:${row.id}`,
      text: content,
      fingerprint: row.updatedAt.toISOString(),
      lexicalScore: 8,
      popularityScore: this.toNumber(row.confidence),
      payload: {
        id: row.id,
        kind: 'APPROVED_PRODUCT_KNOWLEDGE',
        productId: row.productId,
        title: row.fieldPath,
        content,
        confidence: this.toNullableNumber(row.confidence),
        sourceUrls: this.toStringArray(row.sourceUrlsJson),
        relevanceScore: 0,
      },
    };
  }

  private mapKnowledgeDocument(
    row: KnowledgeDocumentRow,
  ): AiRetrievalDocument<AiGroundingEvidence> {
    const content = `${row.title}\n${row.content}`.trim().slice(0, 4_000);

    return {
      id: `knowledge:${row.id}`,
      text: content,
      fingerprint: row.updatedAt.toISOString(),
      lexicalScore: 2,
      popularityScore: 0,
      payload: {
        id: row.id,
        kind: 'ADMIN_KNOWLEDGE_DOCUMENT',
        productId: null,
        title: row.title,
        content: row.content.slice(0, 2_400),
        confidence: null,
        sourceUrls: [],
        relevanceScore: 0,
      },
    };
  }

  private applyContextBudget(
    evidence: AiGroundingEvidence[],
  ): AiGroundingEvidence[] {
    const result: AiGroundingEvidence[] = [];
    let remainingCharacters = 12_000;

    for (const item of evidence) {
      if (remainingCharacters <= 0) {
        break;
      }

      const maximumForItem =
        item.kind === 'APPROVED_PRODUCT_KNOWLEDGE' ? 1_200 : 2_400;
      const content = item.content
        .trim()
        .slice(0, Math.min(maximumForItem, remainingCharacters));

      if (!content) {
        continue;
      }

      result.push({
        ...item,
        content,
      });
      remainingCharacters -= content.length;
    }

    return result;
  }

  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = this.toNumber(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value === 'object') {
      try {
        const serialized = JSON.stringify(value);

        if (typeof serialized !== 'string') {
          return Number.NaN;
        }

        const normalized = serialized.replace(/^"|"$/g, '');

        return Number(normalized);
      } catch {
        return Number.NaN;
      }
    }

    return Number.NaN;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
