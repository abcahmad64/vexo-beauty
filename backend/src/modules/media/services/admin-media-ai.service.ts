import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminMediaAiAltTextApplyDto,
  AdminMediaAiAltTextDraftDto,
  AdminMediaAiBannerTextDto,
  AdminMediaAiImageDescriptionDto,
} from '../dto/admin-media-ai.dto';

type ProductImageContextRow = {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  productName: string | null;
  productSku: string | null;
  productShortDescription: string | null;
  productDescription: string | null;
  productStatus: string | null;
  productIsActive: boolean | null;
  categoryName: string | null;
  brandName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProductContextRow = {
  id: string;
  name: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  status: string;
  isActive: boolean;
  price: Prisma.Decimal | number | string;
  comparePrice: Prisma.Decimal | number | string | null;
  categoryName: string | null;
  brandName: string | null;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
};

type CategoryContextRow = {
  id: string;
  name: string;
  slug: string;
};

type BrandContextRow = {
  id: string;
  name: string;
  slug: string;
};

type PublicTool = Pick<
  AiToolDefinition,
  'name' | 'title' | 'riskLevel' | 'executionMode' | 'requiresApproval'
>;

@Injectable()
export class AdminMediaAiService {
  private readonly model = 'backend-deterministic-media-vision-builder';

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  async generateImageDescription(
    dto: AdminMediaAiImageDescriptionDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAllowed('vision.image.description', context);

    const image = await this.resolveImageContext(dto);

    const description = this.buildImageDescription(image, dto);

    return {
      description,
      image: this.mapImageContext(image),
      model: this.model,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'media.ai_image_description_generated',
      },
    };
  }

  async generateAltTextDraft(
    dto: AdminMediaAiAltTextDraftDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAllowed('alt.text', context);

    const image = await this.resolveImageContext(dto);

    const draft = this.buildAltTextDraft(image, dto);

    return {
      draft,
      image: this.mapImageContext(image),
      model: this.model,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'media.ai_alt_text_draft_generated',
      },
    };
  }

  async applyAltText(
    dto: AdminMediaAiAltTextApplyDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAllowed('media.alt_text.apply', context);

    this.permissionGuard.assertApprovalAllowed(context, tool.title);

    if (dto.approved !== true) {
      throw new BadRequestException(
        'برای اعمال واقعی alt text هوشمند باید approved=true ارسال شود.',
      );
    }

    const image = await this.resolveImageContext(dto);

    const draft = this.buildAltTextDraft(image, dto);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductImage"
        SET
          "altText" = ${draft.altText},
          "updatedAt" = NOW()
        WHERE "id" = ${dto.imageId}
      `,
    );

    await this.createSystemEvent(
      'media.ai_alt_text.applied',
      'Alt text تصویر محصول توسط ابزار هوشمند و پس از تأیید ادمین اعمال شد.',
      dto.imageId,
      context.userId ?? undefined,
      {
        imageId: dto.imageId,
        productId: image.productId,
        altText: draft.altText,
        approvalReason: dto.approvalReason ?? null,
        aiTool: tool.name,
      },
    );

    return {
      draft,
      image: await this.findImageById(dto.imageId),
      applied: true,
      model: this.model,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'media.ai_alt_text_applied',
        approvalReason: dto.approvalReason ?? null,
      },
    };
  }

  async generateBannerText(
    dto: AdminMediaAiBannerTextDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAllowed('banner.text', context);

    const product = dto.productId
      ? await this.findProductContext(dto.productId)
      : null;

    const category =
      !product && dto.categoryId
        ? await this.findCategoryContext(dto.categoryId)
        : null;

    const brand =
      !product && dto.brandId ? await this.findBrandContext(dto.brandId) : null;

    const draft = this.buildBannerDraft(dto, product, category, brand);

    return {
      draft,
      context: {
        product,
        category,
        brand,
      },
      model: this.model,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'media.ai_banner_text_generated',
      },
    };
  }

  private assertToolAllowed(
    toolName: string,
    context: AiPermissionContext,
  ): AiToolDefinition {
    this.permissionGuard.assertAuthenticated(context);

    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      tool.title,
    );

    return tool;
  }

  private async resolveImageContext(
    dto:
      | AdminMediaAiImageDescriptionDto
      | AdminMediaAiAltTextDraftDto
      | AdminMediaAiAltTextApplyDto,
  ): Promise<ProductImageContextRow> {
    if (dto.imageId) {
      return this.findImageById(dto.imageId);
    }

    if (dto.productId) {
      return this.findPrimaryImageByProductId(dto.productId);
    }

    if (dto.imageUrl) {
      return this.buildExternalImageContext(dto.imageUrl);
    }

    throw new BadRequestException(
      'برای تولید توضیح تصویر یا alt text باید imageId، productId یا imageUrl ارسال شود.',
    );
  }

  private async findImageById(
    imageId: string,
  ): Promise<ProductImageContextRow> {
    const rows = await this.prisma.$queryRaw<ProductImageContextRow[]>(
      Prisma.sql`
          SELECT
            pi."id",
            pi."productId",
            pi."url",
            pi."altText",
            pi."sortOrder",
            pi."isPrimary",
            pi."createdAt",
            pi."updatedAt",
            p."name" AS "productName",
            p."sku" AS "productSku",
            p."shortDescription" AS "productShortDescription",
            p."description" AS "productDescription",
            p."status"::text AS "productStatus",
            p."isActive" AS "productIsActive",
            c."name" AS "categoryName",
            b."name" AS "brandName"
          FROM "ProductImage" pi
          LEFT JOIN "Product" p
            ON p."id" = pi."productId"
          LEFT JOIN "Category" c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" b
            ON b."id" = p."brandId"
          WHERE pi."id" = ${imageId}
          LIMIT 1
        `,
    );

    const image = rows[0];

    if (!image) {
      throw new NotFoundException('تصویر محصول موردنظر پیدا نشد.');
    }

    return image;
  }

  private async findPrimaryImageByProductId(
    productId: string,
  ): Promise<ProductImageContextRow> {
    const rows = await this.prisma.$queryRaw<ProductImageContextRow[]>(
      Prisma.sql`
          SELECT
            pi."id",
            pi."productId",
            pi."url",
            pi."altText",
            pi."sortOrder",
            pi."isPrimary",
            pi."createdAt",
            pi."updatedAt",
            p."name" AS "productName",
            p."sku" AS "productSku",
            p."shortDescription" AS "productShortDescription",
            p."description" AS "productDescription",
            p."status"::text AS "productStatus",
            p."isActive" AS "productIsActive",
            c."name" AS "categoryName",
            b."name" AS "brandName"
          FROM "ProductImage" pi
          LEFT JOIN "Product" p
            ON p."id" = pi."productId"
          LEFT JOIN "Category" c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" b
            ON b."id" = p."brandId"
          WHERE pi."productId" = ${productId}
          ORDER BY
            pi."isPrimary" DESC,
            pi."sortOrder" ASC,
            pi."createdAt" ASC
          LIMIT 1
        `,
    );

    const image = rows[0];

    if (!image) {
      throw new NotFoundException('برای این محصول تصویر ثبت‌شده پیدا نشد.');
    }

    return image;
  }

  private buildExternalImageContext(imageUrl: string): ProductImageContextRow {
    return {
      id: 'external-image',
      productId: 'external',
      url: imageUrl,
      altText: null,
      sortOrder: 0,
      isPrimary: false,
      productName: null,
      productSku: null,
      productShortDescription: null,
      productDescription: null,
      productStatus: null,
      productIsActive: null,
      categoryName: null,
      brandName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async findProductContext(
    productId: string,
  ): Promise<ProductContextRow> {
    const rows = await this.prisma.$queryRaw<ProductContextRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."sku",
            p."shortDescription",
            p."description",
            p."status"::text AS "status",
            p."isActive",
            p."price",
            p."comparePrice",
            c."name" AS "categoryName",
            b."name" AS "brandName",
            image."url" AS "primaryImageUrl",
            image."altText" AS "primaryImageAlt"
          FROM "Product" p
          LEFT JOIN "Category" c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" b
            ON b."id" = p."brandId"
          LEFT JOIN LATERAL (
            SELECT
              pi."url",
              pi."altText"
            FROM "ProductImage" pi
            WHERE pi."productId" = p."id"
            ORDER BY
              pi."isPrimary" DESC,
              pi."sortOrder" ASC,
              pi."createdAt" ASC
            LIMIT 1
          ) image ON TRUE
          WHERE
            p."id" = ${productId}
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product) {
      throw new NotFoundException('محصول موردنظر برای تولید متن بنر پیدا نشد.');
    }

    return product;
  }

  private async findCategoryContext(
    categoryId: string,
  ): Promise<CategoryContextRow> {
    const rows = await this.prisma.$queryRaw<CategoryContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "slug"
          FROM "Category"
          WHERE
            "id" = ${categoryId}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const category = rows[0];

    if (!category) {
      throw new NotFoundException(
        'دسته‌بندی موردنظر برای تولید متن بنر پیدا نشد.',
      );
    }

    return category;
  }

  private async findBrandContext(brandId: string): Promise<BrandContextRow> {
    const rows = await this.prisma.$queryRaw<BrandContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "slug"
          FROM "Brand"
          WHERE
            "id" = ${brandId}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const brand = rows[0];

    if (!brand) {
      throw new NotFoundException('برند موردنظر برای تولید متن بنر پیدا نشد.');
    }

    return brand;
  }

  private buildImageDescription(
    image: ProductImageContextRow,
    dto: AdminMediaAiImageDescriptionDto,
  ) {
    const productName =
      this.safeText(image.productName) ?? 'محصول فروشگاه VEXO Beauty';

    const categoryPart = image.categoryName
      ? ` در دسته ${this.safeText(image.categoryName)}`
      : '';

    const brandPart = image.brandName
      ? ` از برند ${this.safeText(image.brandName)}`
      : '';

    const contextPart = dto.context
      ? ` زمینه استفاده: ${this.safeText(dto.context)}.`
      : '';

    const text = this.cleanOutputText(
      `این تصویر به محصول ${productName}${brandPart}${categoryPart} مربوط است. توضیح بر اساس اطلاعات ثبت‌شده محصول و رسانه تولید شده و تحلیل بصری قطعی محسوب نمی‌شود.${contextPart}`,
    );

    return {
      title: `توضیح تصویر ${productName}`,
      description: text,
      confidence: 'contextual',
      imageUrl: image.url,
      guardrails: this.mediaGuardrails(),
    };
  }

  private buildAltTextDraft(
    image: ProductImageContextRow,
    dto: AdminMediaAiAltTextDraftDto | AdminMediaAiAltTextApplyDto,
  ) {
    const productName = this.safeText(image.productName) ?? 'محصول VEXO Beauty';

    const pieces = [
      productName,
      image.brandName ? `برند ${this.safeText(image.brandName)}` : null,
      image.categoryName ? `دسته ${this.safeText(image.categoryName)}` : null,
    ].filter(Boolean) as string[];

    const maxLength = Math.min(Math.max(dto.maxLength ?? 120, 40), 180);

    const altText = this.truncateCleanText(pieces.join('، '), maxLength);

    return {
      altText,
      previousAltText: image.altText,
      length: altText.length,
      maxLength,
      source: 'ai-media-context',
      guardrails: this.mediaGuardrails(),
    };
  }

  private buildBannerDraft(
    dto: AdminMediaAiBannerTextDto,
    product: ProductContextRow | null,
    category: CategoryContextRow | null,
    brand: BrandContextRow | null,
  ) {
    const targetName =
      product?.name ?? category?.name ?? brand?.name ?? 'VEXO Beauty';

    const safeTarget = this.safeText(targetName) ?? 'VEXO Beauty';

    const goal = this.safeText(dto.campaignGoal) ?? 'کمپین فروشگاه';

    const audience = this.safeText(dto.audience) ?? 'مشتریان فروشگاه';

    const cta = this.truncateCleanText(dto.cta ?? 'مشاهده محصولات', 40);

    const headline = this.truncateCleanText(
      product
        ? `${safeTarget} را هوشمندانه انتخاب کنید`
        : `${safeTarget} برای روتین زیبایی شما`,
      80,
    );

    const subtitle = this.truncateCleanText(
      `پیشنهاد مناسب برای ${audience} با تمرکز بر ${goal}.`,
      dto.maxLength ?? 180,
    );

    const keywords = this.normalizeKeywords(dto.keywords);

    return {
      headline,
      subtitle,
      cta,
      shortText: this.truncateCleanText(`${headline}؛ ${cta}`, 120),
      variants: [
        {
          headline,
          subtitle,
          cta,
        },
        {
          headline: this.truncateCleanText(
            `${safeTarget}، انتخابی مطمئن برای خرید بعدی`,
            80,
          ),
          subtitle: this.truncateCleanText(
            `بر اساس اطلاعات ثبت‌شده فروشگاه، گزینه‌های مرتبط را بررسی کنید.`,
            dto.maxLength ?? 180,
          ),
          cta,
        },
      ],
      keywords,
      channel: dto.channel ?? null,
      tone: dto.tone ?? null,
      guardrails: this.mediaGuardrails(),
    };
  }

  private mapImageContext(image: ProductImageContextRow) {
    return {
      id: image.id,
      productId: image.productId,
      url: image.url,
      altText: image.altText,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
      product: {
        name: image.productName,
        sku: image.productSku,
        category: image.categoryName,
        brand: image.brandName,
        status: image.productStatus,
        isActive: image.productIsActive,
      },
      updatedAt: image.updatedAt.toISOString(),
    };
  }

  private async createSystemEvent(
    name: string,
    description: string,
    mediaKey: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "Event" (
            "id",
            "name",
            "description",
            "category",
            "timestamp",
            "userId",
            "data",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${name},
            ${description},
            'media',
            NOW(),
            ${actorId ?? null},
            ${JSON.stringify({ mediaKey, ...data })}::jsonb,
            NOW(),
            NOW()
          )
        `,
      );
    } catch {
      // Audit event failure must not block the approved media update.
    }
  }

  private mediaGuardrails(): string[] {
    return [
      'خروجی بدون ادعای درمانی، قطعی یا اغراق‌آمیز تولید شد.',
      'قیمت، موجودی و ویژگی‌های محصول از متن تصویر حدس زده نمی‌شود.',
      'تحلیل تصویر تا زمانی که فایل واقعی به مدل vision داده نشود، contextual و محتاطانه است.',
      'اعمال واقعی alt text فقط با approved=true انجام می‌شود.',
    ];
  }

  private normalizeKeywords(keywords?: string[]): string[] {
    return [
      ...new Set(
        (keywords ?? [])
          .map((keyword) => this.safeText(keyword))
          .filter((keyword): keyword is string => Boolean(keyword))
          .slice(0, 10),
      ),
    ];
  }

  private truncateCleanText(value: string, maxLength: number): string {
    const cleaned = this.cleanOutputText(value);

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned
      .slice(0, maxLength)
      .replace(/\s+\S*$/, '')
      .trim();
  }

  private cleanOutputText(value: string): string {
    return value
      .replace(/درمان قطعی/gi, 'کمک به مراقبت')
      .replace(/تضمین نتیجه/gi, 'قابل بررسی')
      .replace(/بدون عوارض/gi, 'با توجه به نیاز فردی')
      .replace(/جایگزین پزشک/gi, 'غیرجایگزین مشاوره تخصصی')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private safeText(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = Array.from(value, (character) => {
      const codePoint = character.codePointAt(0);

      return codePoint !== undefined &&
        (codePoint <= 0x1f || codePoint === 0x7f)
        ? ' '
        : character;
    })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return null;
    }

    if (/[ØÙÚÛ�]|â€/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  private toPublicTool(tool: AiToolDefinition): PublicTool {
    return {
      name: tool.name,
      title: tool.title,
      riskLevel: tool.riskLevel,
      executionMode: tool.executionMode,
      requiresApproval: tool.requiresApproval,
    };
  }
}
