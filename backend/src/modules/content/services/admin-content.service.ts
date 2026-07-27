import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminContentNoteDto } from '../dto/admin-content-note.dto';

import { AdminCreateCmsBlockDto } from '../dto/admin-create-cms-block.dto';

import { AdminCreateCmsFaqDto } from '../dto/admin-create-cms-faq.dto';

import { AdminCreateCmsPageDto } from '../dto/admin-create-cms-page.dto';

import { AdminQueryContentDto } from '../dto/admin-query-content.dto';

import { AdminUpdateCmsBlockDto } from '../dto/admin-update-cms-block.dto';

import { AdminUpdateCmsFaqDto } from '../dto/admin-update-cms-faq.dto';

import { AdminUpdateCmsPageDto } from '../dto/admin-update-cms-page.dto';

import { AdminUpdateCmsStatusDto } from '../dto/admin-update-cms-status.dto';

type CountRow = {
  count: number | bigint;
};

type CmsPageRow = {
  id: string;
  slug: string;
  language: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  contentJson: unknown;
  status: string;
  visibility: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CmsBlockRow = {
  id: string;
  key: string;
  language: string;
  placement: string;
  title: string | null;
  body: string | null;
  contentJson: unknown;
  status: string;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CmsFaqRow = {
  id: string;
  language: string;
  category: string;
  question: string;
  answer: string;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  userId: string | null;
  data: unknown;
  timestamp: Date;
  createdAt: Date;
};

@Injectable()
export class AdminContentService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findPages(query: AdminQueryContentDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildPageWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CmsPageRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "slug",
              "language",
              "title",
              "excerpt",
              "body",
              "contentJson",
              "status",
              "visibility",
              "metaTitle",
              "metaDescription",
              "canonicalUrl",
              "ogImageUrl",
              "noIndex",
              "publishedAt",
              "createdAt",
              "updatedAt",
              "deleted_at" AS "deletedAt"
            FROM "CmsPage"
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolvePageSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              "id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "CmsPage"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapPage(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPage(pageId: string, includeDeleted = true) {
    const page = await this.findPageRow(pageId, includeDeleted);

    const notes = await this.findNotes(
      'cms.page.note.created',
      'pageId',
      pageId,
      30,
    );

    return {
      ...this.mapPage(page),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async findPublishedPage(slug: string) {
    const normalizedSlug = this.normalizeSlug(slug);
    const rows = await this.prisma.$queryRaw<CmsPageRow[]>(
      Prisma.sql`
        SELECT
          "id", "slug", "language", "title", "excerpt", "body",
          "contentJson", "status", "visibility", "metaTitle",
          "metaDescription", "canonicalUrl", "ogImageUrl", "noIndex",
          "publishedAt", "createdAt", "updatedAt", "deleted_at" AS "deletedAt"
        FROM "CmsPage"
        WHERE
          LOWER("slug") = LOWER(${normalizedSlug})
          AND "language" = 'fa'
          AND "status" = 'PUBLISHED'
          AND "visibility" = 'PUBLIC'
          AND "deleted_at" IS NULL
          AND ("publishedAt" IS NULL OR "publishedAt" <= NOW())
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
    );
    const page = rows[0];

    if (!page) {
      throw new NotFoundException('صفحه عمومی موردنظر یافت نشد.');
    }

    return {
      slug: page.slug,
      language: page.language,
      title: page.title,
      excerpt: page.excerpt,
      body: page.body,
      contentJson: page.contentJson,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      ogImageUrl: page.ogImageUrl,
      noIndex: page.noIndex,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    };
  }

  async createPage(dto: AdminCreateCmsPageDto, actorId?: string) {
    const slug = this.normalizeSlug(dto.slug);

    const language = this.normalizeLanguage(dto.language);

    await this.assertPageSlugUnique(slug, language);

    const pageId = randomUUID();

    const status = dto.status ?? 'DRAFT';

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CmsPage" (
          "id",
          "slug",
          "language",
          "title",
          "excerpt",
          "body",
          "contentJson",
          "status",
          "visibility",
          "metaTitle",
          "metaDescription",
          "canonicalUrl",
          "ogImageUrl",
          "noIndex",
          "publishedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${pageId},
          ${slug},
          ${language},
          ${dto.title},
          ${dto.excerpt ?? null},
          ${dto.body ?? null},
          ${JSON.stringify(dto.contentJson ?? {})}::jsonb,
          ${status},
          ${dto.visibility ?? 'PUBLIC'},
          ${dto.metaTitle ?? null},
          ${dto.metaDescription ?? null},
          ${dto.canonicalUrl ?? null},
          ${dto.ogImageUrl ?? null},
          ${dto.noIndex ?? false},
          ${this.resolvePublishedAt(status, dto.publishedAt)},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'cms.page.created',
      'صفحه محتوایی توسط ادمین ایجاد شد.',
      pageId,
      actorId,
      {
        pageId,
        slug,
        language,
      },
    );

    return {
      page: await this.findPage(pageId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'cms.page_created',
      },
    };
  }

  async updatePage(
    pageId: string,
    dto: AdminUpdateCmsPageDto,
    actorId?: string,
  ) {
    const current = await this.findPageRow(pageId, false);

    const nextSlug =
      dto.slug !== undefined ? this.normalizeSlug(dto.slug) : current.slug;

    const nextLanguage =
      dto.language !== undefined
        ? this.normalizeLanguage(dto.language)
        : current.language;

    if (nextSlug !== current.slug || nextLanguage !== current.language) {
      await this.assertPageSlugUnique(nextSlug, nextLanguage, pageId);
    }

    const assignments = this.buildPageAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی صفحه ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsPage"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${pageId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.page.updated',
      'صفحه محتوایی توسط ادمین به‌روزرسانی شد.',
      pageId,
      actorId,
      {
        pageId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      page: await this.findPage(pageId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'cms.page_updated',
      },
    };
  }

  async updatePageStatus(
    pageId: string,
    dto: AdminUpdateCmsStatusDto,
    actorId?: string,
  ) {
    const current = await this.findPageRow(pageId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsPage"
        SET
          "status" = ${dto.status},
          "publishedAt" = CASE
            WHEN ${dto.status} = 'PUBLISHED'
              THEN COALESCE(${dto.publishedAt ? new Date(dto.publishedAt) : null}, "publishedAt", NOW())
            ELSE "publishedAt"
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${pageId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.page.status.updated',
      'وضعیت صفحه محتوایی توسط ادمین تغییر کرد.',
      pageId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      page: await this.findPage(pageId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'cms.page_status_updated',
      },
    };
  }

  async deletePage(pageId: string, actorId?: string) {
    await this.findPageRow(pageId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsPage"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${pageId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.page.deleted',
      'صفحه محتوایی توسط ادمین حذف نرم شد.',
      pageId,
      actorId,
      {
        pageId,
      },
    );

    return {
      success: true,
      message: 'صفحه محتوایی با موفقیت حذف شد.',
    };
  }

  async restorePage(pageId: string, actorId?: string) {
    await this.findPageRow(pageId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsPage"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${pageId}
      `,
    );

    await this.createSystemEvent(
      'cms.page.restored',
      'صفحه محتوایی حذف‌شده توسط ادمین بازگردانی شد.',
      pageId,
      actorId,
      {
        pageId,
      },
    );

    return {
      page: await this.findPage(pageId, true),
    };
  }

  async findBlocks(query: AdminQueryContentDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildBlockWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CmsBlockRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "key",
              "language",
              "placement",
              "title",
              "body",
              "contentJson",
              "status",
              "sortOrder",
              "startsAt",
              "endsAt",
              "createdAt",
              "updatedAt",
              "deleted_at" AS "deletedAt"
            FROM "CmsBlock"
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveBlockSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              "id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "CmsBlock"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapBlock(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createBlock(dto: AdminCreateCmsBlockDto, actorId?: string) {
    const key = this.normalizeKey(dto.key);

    const language = this.normalizeLanguage(dto.language);

    await this.assertBlockKeyUnique(key, language);

    this.assertDateRange(dto.startsAt, dto.endsAt);

    const blockId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CmsBlock" (
          "id",
          "key",
          "language",
          "placement",
          "title",
          "body",
          "contentJson",
          "status",
          "sortOrder",
          "startsAt",
          "endsAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${blockId},
          ${key},
          ${language},
          ${dto.placement ?? 'general'},
          ${dto.title ?? null},
          ${dto.body ?? null},
          ${JSON.stringify(dto.contentJson ?? {})}::jsonb,
          ${dto.status ?? 'DRAFT'},
          ${dto.sortOrder ?? 0},
          ${dto.startsAt ? new Date(dto.startsAt) : null},
          ${dto.endsAt ? new Date(dto.endsAt) : null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'cms.block.created',
      'بلوک محتوایی توسط ادمین ایجاد شد.',
      blockId,
      actorId,
      {
        blockId,
        key,
        language,
      },
    );

    return {
      block: await this.findBlock(blockId, true),
    };
  }

  async findBlock(blockId: string, includeDeleted = true) {
    const block = await this.findBlockRow(blockId, includeDeleted);

    const notes = await this.findNotes(
      'cms.block.note.created',
      'blockId',
      blockId,
      30,
    );

    return {
      ...this.mapBlock(block),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async updateBlock(
    blockId: string,
    dto: AdminUpdateCmsBlockDto,
    actorId?: string,
  ) {
    const current = await this.findBlockRow(blockId, false);

    const nextKey =
      dto.key !== undefined ? this.normalizeKey(dto.key) : current.key;

    const nextLanguage =
      dto.language !== undefined
        ? this.normalizeLanguage(dto.language)
        : current.language;

    if (nextKey !== current.key || nextLanguage !== current.language) {
      await this.assertBlockKeyUnique(nextKey, nextLanguage, blockId);
    }

    this.assertDateRange(
      dto.clearStartsAt === true
        ? undefined
        : (dto.startsAt ??
            (current.startsAt ? current.startsAt.toISOString() : undefined)),
      dto.clearEndsAt === true
        ? undefined
        : (dto.endsAt ??
            (current.endsAt ? current.endsAt.toISOString() : undefined)),
    );

    const assignments = this.buildBlockAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی بلوک محتوایی ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsBlock"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${blockId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.block.updated',
      'بلوک محتوایی توسط ادمین به‌روزرسانی شد.',
      blockId,
      actorId,
      {
        blockId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      block: await this.findBlock(blockId, true),
    };
  }

  async updateBlockStatus(
    blockId: string,
    dto: AdminUpdateCmsStatusDto,
    actorId?: string,
  ) {
    const current = await this.findBlockRow(blockId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsBlock"
        SET
          "status" = ${dto.status},
          "updatedAt" = NOW()
        WHERE
          "id" = ${blockId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.block.status.updated',
      'وضعیت بلوک محتوایی توسط ادمین تغییر کرد.',
      blockId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      block: await this.findBlock(blockId, true),
    };
  }

  async deleteBlock(blockId: string, actorId?: string) {
    await this.findBlockRow(blockId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsBlock"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${blockId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.block.deleted',
      'بلوک محتوایی توسط ادمین حذف نرم شد.',
      blockId,
      actorId,
      {
        blockId,
      },
    );

    return {
      success: true,
      message: 'بلوک محتوایی با موفقیت حذف شد.',
    };
  }

  async restoreBlock(blockId: string, actorId?: string) {
    await this.findBlockRow(blockId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsBlock"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${blockId}
      `,
    );

    await this.createSystemEvent(
      'cms.block.restored',
      'بلوک محتوایی حذف‌شده توسط ادمین بازگردانی شد.',
      blockId,
      actorId,
      {
        blockId,
      },
    );

    return {
      block: await this.findBlock(blockId, true),
    };
  }

  async findFaqs(query: AdminQueryContentDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildFaqWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CmsFaqRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "language",
              "category",
              "question",
              "answer",
              "status",
              "sortOrder",
              "createdAt",
              "updatedAt",
              "deleted_at" AS "deletedAt"
            FROM "CmsFaq"
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveFaqSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              "id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "CmsFaq"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapFaq(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createFaq(dto: AdminCreateCmsFaqDto, actorId?: string) {
    const faqId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "CmsFaq" (
          "id",
          "language",
          "category",
          "question",
          "answer",
          "status",
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${faqId},
          ${this.normalizeLanguage(dto.language)},
          ${dto.category ?? 'general'},
          ${dto.question},
          ${dto.answer},
          ${dto.status ?? 'DRAFT'},
          ${dto.sortOrder ?? 0},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'cms.faq.created',
      'سؤال متداول توسط ادمین ایجاد شد.',
      faqId,
      actorId,
      {
        faqId,
      },
    );

    return {
      faq: await this.findFaq(faqId, true),
    };
  }

  async findFaq(faqId: string, includeDeleted = true) {
    const faq = await this.findFaqRow(faqId, includeDeleted);

    const notes = await this.findNotes(
      'cms.faq.note.created',
      'faqId',
      faqId,
      30,
    );

    return {
      ...this.mapFaq(faq),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async updateFaq(faqId: string, dto: AdminUpdateCmsFaqDto, actorId?: string) {
    await this.findFaqRow(faqId, false);

    const assignments = this.buildFaqAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سؤال متداول ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsFaq"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${faqId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.faq.updated',
      'سؤال متداول توسط ادمین به‌روزرسانی شد.',
      faqId,
      actorId,
      {
        faqId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      faq: await this.findFaq(faqId, true),
    };
  }

  async updateFaqStatus(
    faqId: string,
    dto: AdminUpdateCmsStatusDto,
    actorId?: string,
  ) {
    const current = await this.findFaqRow(faqId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsFaq"
        SET
          "status" = ${dto.status},
          "updatedAt" = NOW()
        WHERE
          "id" = ${faqId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.faq.status.updated',
      'وضعیت سؤال متداول توسط ادمین تغییر کرد.',
      faqId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      faq: await this.findFaq(faqId, true),
    };
  }

  async deleteFaq(faqId: string, actorId?: string) {
    await this.findFaqRow(faqId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsFaq"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${faqId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'cms.faq.deleted',
      'سؤال متداول توسط ادمین حذف نرم شد.',
      faqId,
      actorId,
      {
        faqId,
      },
    );

    return {
      success: true,
      message: 'سؤال متداول با موفقیت حذف شد.',
    };
  }

  async restoreFaq(faqId: string, actorId?: string) {
    await this.findFaqRow(faqId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "CmsFaq"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${faqId}
      `,
    );

    await this.createSystemEvent(
      'cms.faq.restored',
      'سؤال متداول حذف‌شده توسط ادمین بازگردانی شد.',
      faqId,
      actorId,
      {
        faqId,
      },
    );

    return {
      faq: await this.findFaq(faqId, true),
    };
  }

  async createNote(
    entity: 'page' | 'block' | 'faq',
    entityId: string,
    dto: AdminContentNoteDto,
    actorId?: string,
  ) {
    const eventName = `cms.${entity}.note.created`;

    const key = `${entity}Id`;

    await this.createSystemEvent(
      eventName,
      'یادداشت مدیریتی برای محتوای سایت ثبت شد.',
      entityId,
      actorId,
      {
        [key]: entityId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      message: 'یادداشت محتوا با موفقیت ثبت شد.',
    };
  }

  async getDashboard() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        pages: number | bigint;
        publishedPages: number | bigint;
        blocks: number | bigint;
        publishedBlocks: number | bigint;
        faqs: number | bigint;
        publishedFaqs: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            (SELECT COUNT(*)::int FROM "CmsPage" WHERE "deleted_at" IS NULL) AS "pages",
            (SELECT COUNT(*)::int FROM "CmsPage" WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED') AS "publishedPages",
            (SELECT COUNT(*)::int FROM "CmsBlock" WHERE "deleted_at" IS NULL) AS "blocks",
            (SELECT COUNT(*)::int FROM "CmsBlock" WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED') AS "publishedBlocks",
            (SELECT COUNT(*)::int FROM "CmsFaq" WHERE "deleted_at" IS NULL) AS "faqs",
            (SELECT COUNT(*)::int FROM "CmsFaq" WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED') AS "publishedFaqs"
        `,
    );

    const row = rows[0];

    return {
      pages: this.toNumber(row?.pages),
      publishedPages: this.toNumber(row?.publishedPages),
      blocks: this.toNumber(row?.blocks),
      publishedBlocks: this.toNumber(row?.publishedBlocks),
      faqs: this.toNumber(row?.faqs),
      publishedFaqs: this.toNumber(row?.publishedFaqs),
    };
  }

  async findPagesForExport(query: AdminQueryContentDto) {
    const result = await this.findPages({
      ...query,
      page: 1,
      limit: 200,
    });

    return result.data;
  }

  async findBlocksForExport(query: AdminQueryContentDto) {
    const result = await this.findBlocks({
      ...query,
      page: 1,
      limit: 200,
    });

    return result.data;
  }

  async findFaqsForExport(query: AdminQueryContentDto) {
    const result = await this.findFaqs({
      ...query,
      page: 1,
      limit: 200,
    });

    return result.data;
  }

  private async findPageRow(
    pageId: string,
    includeDeleted: boolean,
  ): Promise<CmsPageRow> {
    const where: Prisma.Sql[] = [Prisma.sql`"id" = ${pageId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<CmsPageRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "slug",
            "language",
            "title",
            "excerpt",
            "body",
            "contentJson",
            "status",
            "visibility",
            "metaTitle",
            "metaDescription",
            "canonicalUrl",
            "ogImageUrl",
            "noIndex",
            "publishedAt",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
          FROM "CmsPage"
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const page = rows[0];

    if (!page) {
      throw new NotFoundException('صفحه محتوایی موردنظر یافت نشد.');
    }

    return page;
  }

  private async findBlockRow(
    blockId: string,
    includeDeleted: boolean,
  ): Promise<CmsBlockRow> {
    const where: Prisma.Sql[] = [Prisma.sql`"id" = ${blockId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<CmsBlockRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "key",
            "language",
            "placement",
            "title",
            "body",
            "contentJson",
            "status",
            "sortOrder",
            "startsAt",
            "endsAt",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
          FROM "CmsBlock"
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const block = rows[0];

    if (!block) {
      throw new NotFoundException('بلوک محتوایی موردنظر یافت نشد.');
    }

    return block;
  }

  private async findFaqRow(
    faqId: string,
    includeDeleted: boolean,
  ): Promise<CmsFaqRow> {
    const where: Prisma.Sql[] = [Prisma.sql`"id" = ${faqId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<CmsFaqRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "language",
            "category",
            "question",
            "answer",
            "status",
            "sortOrder",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
          FROM "CmsFaq"
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const faq = rows[0];

    if (!faq) {
      throw new NotFoundException('سؤال متداول موردنظر یافت نشد.');
    }

    return faq;
  }

  private buildPageWhere(query: AdminQueryContentDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          "slug" ILIKE ${`%${query.q}%`}
          OR "title" ILIKE ${`%${query.q}%`}
          OR "excerpt" ILIKE ${`%${query.q}%`}
          OR "body" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.language) {
      where.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.slug) {
      where.push(
        Prisma.sql`"slug" ILIKE ${`%${this.normalizeSlug(query.slug)}%`}`,
      );
    }

    if (query.status) {
      where.push(Prisma.sql`"status" = ${query.status}`);
    }

    if (query.visibility) {
      where.push(Prisma.sql`"visibility" = ${query.visibility}`);
    }

    if (query.noIndex !== undefined) {
      where.push(Prisma.sql`"noIndex" = ${query.noIndex}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`"createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`"createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.publishedFrom) {
      where.push(Prisma.sql`"publishedAt" >= ${new Date(query.publishedFrom)}`);
    }

    if (query.publishedTo) {
      where.push(Prisma.sql`"publishedAt" <= ${new Date(query.publishedTo)}`);
    }

    return where;
  }

  private buildBlockWhere(query: AdminQueryContentDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          "key" ILIKE ${`%${query.q}%`}
          OR "title" ILIKE ${`%${query.q}%`}
          OR "body" ILIKE ${`%${query.q}%`}
          OR "placement" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.language) {
      where.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.key) {
      where.push(
        Prisma.sql`"key" ILIKE ${`%${this.normalizeKey(query.key)}%`}`,
      );
    }

    if (query.placement) {
      where.push(Prisma.sql`"placement" ILIKE ${`%${query.placement}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`"status" = ${query.status}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`"createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`"createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildFaqWhere(query: AdminQueryContentDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`"deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          "question" ILIKE ${`%${query.q}%`}
          OR "answer" ILIKE ${`%${query.q}%`}
          OR "category" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.language) {
      where.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.category) {
      where.push(Prisma.sql`"category" ILIKE ${`%${query.category}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`"status" = ${query.status}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`"createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`"createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildPageAssignments(dto: AdminUpdateCmsPageDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.slug !== undefined) {
      assignments.push(Prisma.sql`"slug" = ${this.normalizeSlug(dto.slug)}`);
    }

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.excerpt !== undefined) {
      assignments.push(Prisma.sql`"excerpt" = ${dto.excerpt}`);
    }

    if (dto.body !== undefined) {
      assignments.push(Prisma.sql`"body" = ${dto.body}`);
    }

    if (dto.contentJson !== undefined) {
      assignments.push(
        Prisma.sql`"contentJson" = ${JSON.stringify(dto.contentJson)}::jsonb`,
      );
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}`);
    }

    if (dto.visibility !== undefined) {
      assignments.push(Prisma.sql`"visibility" = ${dto.visibility}`);
    }

    if (dto.metaTitle !== undefined) {
      assignments.push(Prisma.sql`"metaTitle" = ${dto.metaTitle}`);
    }

    if (dto.metaDescription !== undefined) {
      assignments.push(Prisma.sql`"metaDescription" = ${dto.metaDescription}`);
    }

    if (dto.canonicalUrl !== undefined) {
      assignments.push(Prisma.sql`"canonicalUrl" = ${dto.canonicalUrl}`);
    }

    if (dto.ogImageUrl !== undefined) {
      assignments.push(Prisma.sql`"ogImageUrl" = ${dto.ogImageUrl}`);
    }

    if (dto.noIndex !== undefined) {
      assignments.push(Prisma.sql`"noIndex" = ${dto.noIndex}`);
    }

    if (dto.clearPublishedAt === true) {
      assignments.push(Prisma.sql`"publishedAt" = NULL`);
    } else if (dto.publishedAt !== undefined) {
      assignments.push(
        Prisma.sql`"publishedAt" = ${new Date(dto.publishedAt)}`,
      );
    }

    return assignments;
  }

  private buildBlockAssignments(dto: AdminUpdateCmsBlockDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      assignments.push(Prisma.sql`"key" = ${this.normalizeKey(dto.key)}`);
    }

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.placement !== undefined) {
      assignments.push(Prisma.sql`"placement" = ${dto.placement}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.body !== undefined) {
      assignments.push(Prisma.sql`"body" = ${dto.body}`);
    }

    if (dto.contentJson !== undefined) {
      assignments.push(
        Prisma.sql`"contentJson" = ${JSON.stringify(dto.contentJson)}::jsonb`,
      );
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (dto.clearStartsAt === true) {
      assignments.push(Prisma.sql`"startsAt" = NULL`);
    } else if (dto.startsAt !== undefined) {
      assignments.push(Prisma.sql`"startsAt" = ${new Date(dto.startsAt)}`);
    }

    if (dto.clearEndsAt === true) {
      assignments.push(Prisma.sql`"endsAt" = NULL`);
    } else if (dto.endsAt !== undefined) {
      assignments.push(Prisma.sql`"endsAt" = ${new Date(dto.endsAt)}`);
    }

    return assignments;
  }

  private buildFaqAssignments(dto: AdminUpdateCmsFaqDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.category !== undefined) {
      assignments.push(Prisma.sql`"category" = ${dto.category}`);
    }

    if (dto.question !== undefined) {
      assignments.push(Prisma.sql`"question" = ${dto.question}`);
    }

    if (dto.answer !== undefined) {
      assignments.push(Prisma.sql`"answer" = ${dto.answer}`);
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    return assignments;
  }

  private async assertPageSlugUnique(
    slug: string,
    language: string,
    exceptPageId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("slug") = LOWER(${slug})`,
      Prisma.sql`"language" = ${language}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptPageId) {
      where.push(Prisma.sql`"id" <> ${exceptPageId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "CmsPage"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ صفحه برای این زبان تکراری است.');
    }
  }

  private async assertBlockKeyUnique(
    key: string,
    language: string,
    exceptBlockId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("key") = LOWER(${key})`,
      Prisma.sql`"language" = ${language}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptBlockId) {
      where.push(Prisma.sql`"id" <> ${exceptBlockId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "CmsBlock"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'کلید بلوک محتوایی برای این زبان تکراری است.',
      );
    }
  }

  private assertDateRange(startsAt?: string, endsAt?: string): void {
    if (!startsAt || !endsAt) {
      return;
    }

    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
  }

  private findNotes(
    eventName: string,
    dataKey: string,
    entityId: string,
    limit: number,
  ): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "description",
          "category",
          "userId",
          "data",
          "timestamp",
          "createdAt"
        FROM "Event"
        WHERE
          "deleted_at" IS NULL
          AND "name" = ${eventName}
          AND "data" #>> ARRAY[${dataKey}] = ${entityId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    entityId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const eventId = randomUUID();

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
          ${eventId},
          ${name},
          ${description},
          'content',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            entityId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private mapPage(row: CmsPageRow) {
    return {
      id: row.id,
      slug: row.slug,
      language: row.language,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      contentJson: row.contentJson,
      status: row.status,
      visibility: row.visibility,
      seo: {
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
        canonicalUrl: row.canonicalUrl,
        ogImageUrl: row.ogImageUrl,
        noIndex: row.noIndex,
      },
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapBlock(row: CmsBlockRow) {
    return {
      id: row.id,
      key: row.key,
      language: row.language,
      placement: row.placement,
      title: row.title,
      body: row.body,
      contentJson: row.contentJson,
      status: row.status,
      sortOrder: row.sortOrder,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapFaq(row: CmsFaqRow) {
    return {
      id: row.id,
      language: row.language,
      category: row.category,
      question: row.question,
      answer: row.answer,
      status: row.status,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapNote(row: EventRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
    };
  }

  private resolvePageSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`"updatedAt"`;
    }

    if (sortBy === 'publishedAt') {
      return Prisma.sql`"publishedAt"`;
    }

    if (sortBy === 'title') {
      return Prisma.sql`"title"`;
    }

    if (sortBy === 'slug') {
      return Prisma.sql`"slug"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`"status"`;
    }

    if (sortBy === 'language') {
      return Prisma.sql`"language"`;
    }

    return Prisma.sql`"createdAt"`;
  }

  private resolveBlockSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`"updatedAt"`;
    }

    if (sortBy === 'key') {
      return Prisma.sql`"key"`;
    }

    if (sortBy === 'placement') {
      return Prisma.sql`"placement"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`"status"`;
    }

    if (sortBy === 'language') {
      return Prisma.sql`"language"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`"sortOrder"`;
    }

    return Prisma.sql`"createdAt"`;
  }

  private resolveFaqSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`"updatedAt"`;
    }

    if (sortBy === 'category') {
      return Prisma.sql`"category"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`"status"`;
    }

    if (sortBy === 'language') {
      return Prisma.sql`"language"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`"sortOrder"`;
    }

    return Prisma.sql`"createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private resolvePublishedAt(
    status: string,
    publishedAt?: string,
  ): Date | null {
    if (publishedAt) {
      return new Date(publishedAt);
    }

    if (status === 'PUBLISHED') {
      return new Date();
    }

    return null;
  }

  private normalizeSlug(slug: string): string {
    return slug
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private normalizeLanguage(language?: string): string {
    return language?.trim().toLowerCase() || 'fa';
  }

  private normalizePage(page?: number): number {
    if (!page || page < 1) {
      return this.defaultPage;
    }

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return this.defaultLimit;
    }

    return Math.min(limit, this.maxLimit);
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (Prisma.Decimal.isDecimal(value)) {
      return value.toNumber();
    }

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
