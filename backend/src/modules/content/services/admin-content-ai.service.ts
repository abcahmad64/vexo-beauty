import { BadRequestException, Injectable } from '@nestjs/common';

import { AiArticleDto } from '../../ai/dto/ai-article.dto';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import { AiService } from '../../ai/services/ai.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import { AdminCreateCmsPageDto } from '../dto/admin-create-cms-page.dto';

import {
  AdminContentAiArticleDraftDto,
  AdminContentAiArticlePublishDto,
} from '../dto/admin-content-ai.dto';

import { AdminContentService } from './admin-content.service';

type JsonRecord = Record<string, unknown>;

type ArticlePageDraft = {
  slug: string;
  language: string;
  title: string;
  excerpt: string;
  body: string;
  contentJson: JsonRecord;
  status: 'DRAFT' | 'PUBLISHED';
  visibility: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  noIndex: boolean;
  publishedAt?: string;
};

@Injectable()
export class AdminContentAiService {
  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly aiService: AiService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  async generateArticleDraft(
    dto: AdminContentAiArticleDraftDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'content.article.draft',
      context,
      'تولید پیشنویس محتوای سایت',
    );

    const aiResult = await this.aiService.generateArticleDraft(
      this.toAiArticleDto(dto),
      context.userId ?? undefined,
    );

    const pageDraft = this.buildPageDraft(dto, aiResult, 'DRAFT');

    return {
      draft: pageDraft,
      model: this.getRecordValue(aiResult, 'model') ?? null,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'content.ai_article_draft_generated',
      },
    };
  }

  async publishArticle(
    dto: AdminContentAiArticlePublishDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'content.publish.approved',
      context,
      'انتشار محتوای تولیدشده با هوش مصنوعی',
    );

    this.assertApproved(
      dto.approved,
      'برای انتشار واقعی محتوای هوشمند باید approved=true ارسال شود.',
    );

    const aiResult = await this.aiService.generateArticleDraft(
      this.toAiArticleDto(dto),
      context.userId ?? undefined,
    );

    const pageDraft = this.buildPageDraft(dto, aiResult, 'PUBLISHED');

    const created = await this.adminContentService.createPage(
      pageDraft as AdminCreateCmsPageDto,
      context.userId ?? undefined,
    );

    return {
      pageDraft,
      created,
      applied: true,
      model: this.getRecordValue(aiResult, 'model') ?? null,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'content.ai_article_published',
        approvalReason: dto.approvalReason ?? null,
      },
    };
  }

  private assertToolAccess(
    toolName: string,
    context: AiPermissionContext,
    operationTitle: string,
  ): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAuthenticated(context);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      operationTitle,
    );

    if (tool.requiresApproval) {
      this.permissionGuard.assertApprovalAllowed(context, operationTitle);
    }

    return tool;
  }

  private assertApproved(approved: boolean | undefined, message: string): void {
    if (approved !== true) {
      throw new BadRequestException(message);
    }
  }

  private toAiArticleDto(dto: AdminContentAiArticleDraftDto): AiArticleDto {
    const toneParts = [
      dto.tone,
      dto.extraInstruction
        ? `دستور تکمیلی ادمین: ${dto.extraInstruction}`
        : null,
    ]
      .map((item) => this.getString(item))
      .filter((item): item is string => Boolean(item));

    return {
      topic: dto.topic,
      keywords: this.normalizeStringArray(dto.keywords),
      targetAudience: dto.targetAudience,
      tone: toneParts.length > 0 ? toneParts.join('\n') : undefined,
      wordCount: dto.wordCount,
      productIds: this.normalizeStringArray(dto.productIds),
      categoryId: dto.categoryId,
      brandId: dto.brandId,
    };
  }

  private buildPageDraft(
    dto: AdminContentAiArticleDraftDto,
    aiResult: unknown,
    status: 'DRAFT' | 'PUBLISHED',
  ): ArticlePageDraft {
    const resultRecord = this.toRecord(aiResult);

    const generatedTitle = this.stripAdminInstructionLeaks(
      this.getString(resultRecord.title) ?? dto.topic,
    );

    const rawArticle =
      this.getString(resultRecord.article) ??
      this.getString(resultRecord.content) ??
      '';

    const body = this.normalizeArticleBody(rawArticle, dto.topic);

    const title = this.truncateText(
      this.stripAdminInstructionLeaks(dto.title ?? dto.topic ?? generatedTitle),
      180,
    );

    const excerpt = this.truncateText(
      this.stripAdminInstructionLeaks(this.extractExcerpt(body)),
      420,
    );

    const keywords = this.normalizeStringArray(dto.keywords);

    const slug = dto.slug
      ? this.normalizeSlug(dto.slug)
      : this.buildGeneratedSlug(dto.topic);

    const model = this.getString(resultRecord.model) ?? 'unknown';

    const now = new Date();

    return {
      slug,
      language: this.normalizeLanguage(dto.language),
      title,
      excerpt,
      body,
      contentJson: {
        aiGenerated: true,
        source: 'ai-content',
        generator: 'content.article.draft',
        topic: dto.topic,
        keywords,
        targetAudience: dto.targetAudience ?? null,
        tone: dto.tone ?? null,
        wordCount: dto.wordCount ?? null,
        productIds: this.normalizeStringArray(dto.productIds),
        categoryId: dto.categoryId ?? null,
        brandId: dto.brandId ?? null,
        extraInstruction: dto.extraInstruction ?? null,
        model,
        generatedAt: now.toISOString(),
        guardrails: [
          'پیشنویس بدون انتشار خودکار تولید شد.',
          'متن از ادعاهای درمانی، تضمینی و فشار فروش پاک‌سازی شد.',
          'انتشار واقعی فقط با approved=true انجام می‌شود.',
        ],
      },
      status,
      visibility: dto.visibility ?? 'PUBLIC',
      metaTitle: this.truncateText(title, 180),
      metaDescription: this.truncateText(excerpt, 320),
      noIndex: dto.noIndex ?? false,
      publishedAt: status === 'PUBLISHED' ? now.toISOString() : undefined,
    };
  }

  private normalizeArticleBody(value: string, topic: string): string {
    const safe = this.stripAdminInstructionLeaks(
      this.applyContentGuardrails(value),
    );

    if (safe.length >= 200) {
      return safe;
    }

    return [
      `# ${topic}`,
      '',
      'این متن به‌عنوان پیش‌نویس محتوایی امن برای فروشگاه VEXO Beauty تولید شده است.',
      '',
      'در نسخه نهایی، اطلاعات محصول، نیاز مخاطب، کاربرد محتوا و جزئیات سئو را بررسی و تکمیل کنید.',
    ].join('\n');
  }

  private applyContentGuardrails(value: string): string {
    const replacements: Array<[RegExp, string]> = [
      [/درمان قطعی/giu, 'کمک به انتخاب آگاهانه'],
      [/تضمین(?:ی)?/giu, 'پیشنهاد'],
      [/معجزه(?:‌| )?آسا/giu, 'قابل بررسی'],
      [/بهترین در جهان/giu, 'یکی از گزینه‌های قابل بررسی'],
      [/همین حالا مجبورید/giu, 'در صورت تمایل می‌توانید'],
    ];

    let result = value
      .replace(/<script[\s\S]*?<\/script>/giu, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n/g, '\n')
      .trim();

    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }

    return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  private stripAdminInstructionLeaks(value: string): string {
    const marker = 'دستور تکمیلی ادمین';

    let result = value
      .replace(/\s*دستور\s+تکمیلی\s+ادمین\s*:\s*[^.!؟\n\r]*(?:[.!؟]|$)/giu, ' ')
      .replace(/\s*Admin\s+instruction\s*:\s*[^.!?\n\r]*(?:[.!?]|$)/giu, ' ');

    const markerIndex = result.indexOf(marker);

    if (markerIndex >= 0) {
      result = result.slice(0, markerIndex);
    }

    return result.replace(/\s+/g, ' ').trim();
  }

  private extractExcerpt(body: string): string {
    const withoutMarkdown = body
      .replace(/^#+\s+/gm, '')
      .replace(/[*_`>\-[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return withoutMarkdown.length > 0
      ? withoutMarkdown
      : 'پیشنویس محتوایی فروشگاه VEXO Beauty.';
  }

  private normalizeSlug(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalized.length > 0
      ? normalized
      : this.buildGeneratedSlug('article');
  }

  private buildGeneratedSlug(topic: string): string {
    const normalized = this.normalizeSlugBase(topic);

    const suffix = Date.now().toString(36).toLowerCase();

    return `${normalized}-${suffix}`;
  }

  private normalizeSlugBase(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalized.length > 0 ? normalized : 'article';
  }

  private normalizeLanguage(value?: string): string {
    const normalized = value?.trim().toLowerCase();

    return normalized && normalized.length > 0 ? normalized : 'fa';
  }

  private normalizeStringArray(values?: string[]): string[] {
    return [
      ...new Set(
        (values ?? [])
          .map((item) => this.getString(item))
          .filter((item): item is string => Boolean(item))
          .map((item) => this.truncateText(item, 120)),
      ),
    ].slice(0, 20);
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

  private getRecordValue(value: unknown, key: string): unknown {
    return this.toRecord(value)[key];
  }

  private toRecord(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return {};
  }

  private getString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      const result = String(value).replace(/\s+/g, ' ').trim();

      return result.length > 0 ? result : null;
    }

    return null;
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return normalized.slice(0, maxLength - 1).trimEnd();
  }
}
