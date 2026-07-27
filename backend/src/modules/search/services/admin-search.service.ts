import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { AdminQuerySearchLogDto } from '../dto/admin-query-search-log.dto';

import { AdminRunSearchIndexDto } from '../dto/admin-run-search-index.dto';

import {
  AdminCreateSearchBoostRuleDto,
  AdminUpdateSearchBoostRuleDto,
} from '../dto/admin-search-boost-rule.dto';

import { AdminSearchExportQueryDto } from '../dto/admin-search-export-query.dto';

import { AdminSearchNoteDto } from '../dto/admin-search-note.dto';

import {
  AdminCreateSearchRedirectDto,
  AdminUpdateSearchRedirectDto,
} from '../dto/admin-search-redirect.dto';

import {
  AdminCreateSearchSynonymDto,
  AdminUpdateSearchSynonymDto,
} from '../dto/admin-search-synonym.dto';

import { AdminSearchTestDto } from '../dto/admin-search-test.dto';

type CountRow = {
  count: number | bigint;
};

type SearchLogRow = {
  id: string;
  query: string;
  normalizedQuery: string;
  language: string;
  userId: string | null;
  sessionId: string | null;
  source: string;
  resultCount: number;
  clickedEntityType: string | null;
  clickedEntityId: string | null;
  metadata: unknown;
  createdAt: Date;
  deletedAt: Date | null;
};

type SynonymRow = {
  id: string;
  term: string;
  language: string;
  synonymsJson: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type RedirectRow = {
  id: string;
  query: string;
  language: string;
  targetType: string;
  targetId: string | null;
  targetUrl: string | null;
  priority: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type BoostRuleRow = {
  id: string;
  entityType: string;
  entityId: string;
  query: string | null;
  language: string;
  weight: unknown;
  reason: string | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type IndexSnapshotRow = {
  id: string;
  indexName: string;
  status: string;
  documentCount: number;
  durationMs: number | null;
  errorMessage: string | null;
  metadata: unknown;
  createdById: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type SearchResultRow = {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  score: unknown;
  status: string | null;
  updatedAt: Date | null;
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
export class AdminSearchService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [totalRows, zeroRows, topQueries, recentZeroQueries, snapshots] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            total: number | bigint;
            uniqueUsers: number | bigint;
            averageResultCount: unknown;
          }>
        >(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "total",
              COUNT(DISTINCT "userId")::int AS "uniqueUsers",
              COALESCE(AVG("resultCount"), 0)::numeric AS "averageResultCount"
            FROM "SearchQueryLog"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SearchQueryLog"
            WHERE
              "deleted_at" IS NULL
              AND "resultCount" = 0
              AND "createdAt" >= NOW() - INTERVAL '30 days'
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            normalizedQuery: string;
            count: number | bigint;
            averageResultCount: unknown;
          }>
        >(
          Prisma.sql`
            SELECT
              "normalizedQuery",
              COUNT(*)::int AS "count",
              COALESCE(AVG("resultCount"), 0)::numeric AS "averageResultCount"
            FROM "SearchQueryLog"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "normalizedQuery"
            ORDER BY "count" DESC
            LIMIT 10
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            normalizedQuery: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              "normalizedQuery",
              COUNT(*)::int AS "count"
            FROM "SearchQueryLog"
            WHERE
              "deleted_at" IS NULL
              AND "resultCount" = 0
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "normalizedQuery"
            ORDER BY "count" DESC
            LIMIT 10
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            status: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              "status",
              COUNT(*)::int AS "count"
            FROM "SearchIndexSnapshot"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY "status"
            ORDER BY "count" DESC
          `,
        ),
      ]);

    const total = totalRows[0];

    return {
      last30Days: {
        totalSearches: this.toNumber(total?.total),
        zeroResultSearches: this.toNumber(zeroRows[0]?.count),
        uniqueUsers: this.toNumber(total?.uniqueUsers),
        averageResultCount: this.toDecimalString(total?.averageResultCount),
      },
      topQueries: topQueries.map((row) => ({
        query: row.normalizedQuery,
        count: this.toNumber(row.count),
        averageResultCount: this.toDecimalString(row.averageResultCount),
      })),
      zeroResultQueries: recentZeroQueries.map((row) => ({
        query: row.normalizedQuery,
        count: this.toNumber(row.count),
      })),
      indexSnapshots: snapshots.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
      })),
    };
  }

  async testSearch(dto: AdminSearchTestDto, actorId?: string) {
    const query = this.normalizeQuery(dto.q);

    const language = this.normalizeLanguage(dto.language);

    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 50);

    const redirect = await this.findActiveRedirectByQuery(query, language);

    const terms = await this.resolveSearchTerms(query, language);

    const rows = await this.prisma.$queryRaw<SearchResultRow[]>(
      Prisma.sql`
          WITH results AS (
            SELECT
              'PRODUCT'::text AS "entityType",
              p."id" AS "entityId",
              p."name" AS "title",
              p."sku" AS "subtitle",
              p."slug" AS "slug",
              COALESCE(MAX(b."weight"), 1)::numeric AS "score",
              p."status"::text AS "status",
              p."updatedAt" AS "updatedAt"
            FROM "Product" p
            LEFT JOIN "SearchBoostRule" b
              ON b."entityType" = 'PRODUCT'
              AND b."entityId" = p."id"
              AND b."deleted_at" IS NULL
              AND b."isActive" = TRUE
              AND b."language" = ${language}
              AND (
                b."query" IS NULL
                OR LOWER(b."query") = LOWER(${query})
              )
              AND (
                b."startsAt" IS NULL
                OR b."startsAt" <= NOW()
              )
              AND (
                b."endsAt" IS NULL
                OR b."endsAt" >= NOW()
              )
            WHERE
              p."deleted_at" IS NULL
              ${dto.includeInactive === true ? Prisma.empty : Prisma.sql`AND p."status"::text <> 'INACTIVE'`}
              AND (
                ${this.productSearchConditions(terms)}
              )
            GROUP BY
              p."id",
              p."name",
              p."sku",
              p."slug",
              p."status"::text,
              p."updatedAt"

            UNION ALL

            SELECT
              'CATEGORY'::text AS "entityType",
              c."id" AS "entityId",
              c."name" AS "title",
              c."slug" AS "subtitle",
              c."slug" AS "slug",
              COALESCE(MAX(b."weight"), 1)::numeric AS "score",
              CASE
                WHEN c."isActive" = TRUE THEN 'ACTIVE'
                ELSE 'INACTIVE'
              END AS "status",
              c."updatedAt" AS "updatedAt"
            FROM "Category" c
            LEFT JOIN "SearchBoostRule" b
              ON b."entityType" = 'CATEGORY'
              AND b."entityId" = c."id"
              AND b."deleted_at" IS NULL
              AND b."isActive" = TRUE
              AND b."language" = ${language}
              AND (
                b."query" IS NULL
                OR LOWER(b."query") = LOWER(${query})
              )
              AND (
                b."startsAt" IS NULL
                OR b."startsAt" <= NOW()
              )
              AND (
                b."endsAt" IS NULL
                OR b."endsAt" >= NOW()
              )
            WHERE
              c."deleted_at" IS NULL
              ${dto.includeInactive === true ? Prisma.empty : Prisma.sql`AND c."isActive" = TRUE`}
              AND (
                ${this.categorySearchConditions(terms)}
              )
            GROUP BY
              c."id",
              c."name",
              c."slug",
              c."isActive",
              c."updatedAt"

            UNION ALL

            SELECT
              'BRAND'::text AS "entityType",
              bnd."id" AS "entityId",
              bnd."name" AS "title",
              bnd."slug" AS "subtitle",
              bnd."slug" AS "slug",
              COALESCE(MAX(br."weight"), 1)::numeric AS "score",
              CASE
                WHEN bnd."isActive" = TRUE THEN 'ACTIVE'
                ELSE 'INACTIVE'
              END AS "status",
              bnd."updatedAt" AS "updatedAt"
            FROM "Brand" bnd
            LEFT JOIN "SearchBoostRule" br
              ON br."entityType" = 'BRAND'
              AND br."entityId" = bnd."id"
              AND br."deleted_at" IS NULL
              AND br."isActive" = TRUE
              AND br."language" = ${language}
              AND (
                br."query" IS NULL
                OR LOWER(br."query") = LOWER(${query})
              )
              AND (
                br."startsAt" IS NULL
                OR br."startsAt" <= NOW()
              )
              AND (
                br."endsAt" IS NULL
                OR br."endsAt" >= NOW()
              )
            WHERE
              bnd."deleted_at" IS NULL
              ${dto.includeInactive === true ? Prisma.empty : Prisma.sql`AND bnd."isActive" = TRUE`}
              AND (
                ${this.brandSearchConditions(terms)}
              )
            GROUP BY
              bnd."id",
              bnd."name",
              bnd."slug",
              bnd."isActive",
              bnd."updatedAt"
          )
          SELECT *
          FROM results
          ORDER BY
            "score" DESC,
            "updatedAt" DESC NULLS LAST,
            "title" ASC
          LIMIT ${limit}
        `,
    );

    await this.createSearchLog(query, language, rows.length, actorId, {
      adminTest: true,
      redirect: redirect ? this.mapRedirect(redirect) : null,
      terms,
    });

    return {
      query,
      language,
      redirect: redirect ? this.mapRedirect(redirect) : null,
      terms,
      results: rows.map((row) => this.mapSearchResult(row)),
      meta: {
        total: rows.length,
        limit,
      },
    };
  }

  async findLogs(query: AdminQuerySearchLogDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildLogWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SearchLogRow[]>(
        Prisma.sql`
            ${this.logSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              l."createdAt" DESC,
              l."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SearchQueryLog" l
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapLog(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findSynonyms(query: AdminSearchExportQueryDto) {
    const where = this.buildSimpleSearchWhere('s', query, ['term']);

    const rows = await this.prisma.$queryRaw<SynonymRow[]>(
      Prisma.sql`
          ${this.synonymSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            s."language" ASC,
            s."term" ASC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapSynonym(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createSynonym(dto: AdminCreateSearchSynonymDto, actorId?: string) {
    const term = this.normalizeQuery(dto.term);

    const language = this.normalizeLanguage(dto.language);

    await this.assertSynonymUnique(term, language);

    const synonymId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SearchSynonym" (
          "id",
          "term",
          "language",
          "synonymsJson",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${synonymId},
          ${term},
          ${language},
          ${JSON.stringify(this.normalizeStringArray(dto.synonyms))}::jsonb,
          ${dto.isActive ?? true},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'search.synonym.created',
      'مترادف جست‌وجو توسط ادمین ایجاد شد.',
      synonymId,
      actorId,
      {
        synonymId,
        term,
        language,
      },
    );

    return {
      synonym: await this.findSynonym(synonymId, true),
    };
  }

  async findSynonym(synonymId: string, includeDeleted = true) {
    const row = await this.findSynonymRow(synonymId, includeDeleted);

    return this.mapSynonym(row);
  }

  async updateSynonym(
    synonymId: string,
    dto: AdminUpdateSearchSynonymDto,
    actorId?: string,
  ) {
    const current = await this.findSynonymRow(synonymId, false);

    const nextTerm = dto.term ? this.normalizeQuery(dto.term) : current.term;

    const nextLanguage = dto.language
      ? this.normalizeLanguage(dto.language)
      : current.language;

    if (nextTerm !== current.term || nextLanguage !== current.language) {
      await this.assertSynonymUnique(nextTerm, nextLanguage, synonymId);
    }

    const assignments: Prisma.Sql[] = [];

    if (dto.term !== undefined) {
      assignments.push(Prisma.sql`"term" = ${nextTerm}`);
    }

    if (dto.language !== undefined) {
      assignments.push(Prisma.sql`"language" = ${nextLanguage}`);
    }

    if (dto.synonyms !== undefined) {
      assignments.push(
        Prisma.sql`"synonymsJson" = ${JSON.stringify(this.normalizeStringArray(dto.synonyms))}::jsonb`,
      );
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی مترادف جست‌وجو ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SearchSynonym"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${synonymId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'search.synonym.updated',
      'مترادف جست‌وجو توسط ادمین به‌روزرسانی شد.',
      synonymId,
      actorId,
      {
        synonymId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      synonym: await this.findSynonym(synonymId, true),
    };
  }

  async deleteSynonym(synonymId: string, actorId?: string) {
    await this.findSynonymRow(synonymId, false);

    const deletedAt = await this.softDeleteTableRow('SearchSynonym', synonymId);

    await this.createSystemEvent(
      'search.synonym.deleted',
      'مترادف جست‌وجو توسط ادمین حذف نرم شد.',
      synonymId,
      actorId,
      {
        synonymId,
      },
    );

    return {
      success: true,
      message: 'مترادف جست‌وجو با موفقیت حذف شد.',
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTime(deletedAt),
    };
  }

  async restoreSynonym(synonymId: string, actorId?: string) {
    await this.findSynonymRow(synonymId, true);

    const restoredAt = await this.restoreTableRow('SearchSynonym', synonymId);

    await this.createSystemEvent(
      'search.synonym.restored',
      'مترادف جست‌وجو توسط ادمین بازگردانی شد.',
      synonymId,
      actorId,
      {
        synonymId,
      },
    );

    return {
      synonym: await this.findSynonym(synonymId, true),
      restoredAt: restoredAt.toISOString(),
      restoredAtFa: this.formatDateTime(restoredAt),
    };
  }

  async findRedirects(query: AdminSearchExportQueryDto) {
    const where = this.buildSimpleSearchWhere('r', query, [
      'query',
      'targetId',
      'targetUrl',
    ]);

    const rows = await this.prisma.$queryRaw<RedirectRow[]>(
      Prisma.sql`
          ${this.redirectSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            r."priority" DESC,
            r."createdAt" DESC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapRedirect(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createRedirect(dto: AdminCreateSearchRedirectDto, actorId?: string) {
    this.assertRedirectTarget(dto.targetType, dto.targetId, dto.targetUrl);
    this.assertDateRange(dto.startsAt, dto.endsAt);

    const query = this.normalizeQuery(dto.query);

    const language = this.normalizeLanguage(dto.language);

    await this.assertRedirectUnique(query, language);

    const redirectId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SearchRedirect" (
          "id",
          "query",
          "language",
          "targetType",
          "targetId",
          "targetUrl",
          "priority",
          "isActive",
          "startsAt",
          "endsAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${redirectId},
          ${query},
          ${language},
          ${dto.targetType},
          ${dto.targetId ?? null},
          ${dto.targetUrl ?? null},
          ${dto.priority ?? 0},
          ${dto.isActive ?? true},
          ${dto.startsAt ? new Date(dto.startsAt) : null},
          ${dto.endsAt ? new Date(dto.endsAt) : null},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'search.redirect.created',
      'ریدایرکت جست‌وجو توسط ادمین ایجاد شد.',
      redirectId,
      actorId,
      {
        redirectId,
        query,
        language,
      },
    );

    return {
      redirect: await this.findRedirect(redirectId, true),
    };
  }

  async findRedirect(redirectId: string, includeDeleted = true) {
    const row = await this.findRedirectRow(redirectId, includeDeleted);

    return this.mapRedirect(row);
  }

  async updateRedirect(
    redirectId: string,
    dto: AdminUpdateSearchRedirectDto,
    actorId?: string,
  ) {
    const current = await this.findRedirectRow(redirectId, false);

    const nextQuery = dto.query
      ? this.normalizeQuery(dto.query)
      : current.query;

    const nextLanguage = dto.language
      ? this.normalizeLanguage(dto.language)
      : current.language;

    const nextTargetType = dto.targetType ?? current.targetType;

    const nextTargetId =
      dto.targetId !== undefined ? dto.targetId : current.targetId;

    const nextTargetUrl =
      dto.targetUrl !== undefined ? dto.targetUrl : current.targetUrl;

    this.assertRedirectTarget(nextTargetType, nextTargetId, nextTargetUrl);

    if (nextQuery !== current.query || nextLanguage !== current.language) {
      await this.assertRedirectUnique(nextQuery, nextLanguage, redirectId);
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

    const assignments = this.buildRedirectAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی ریدایرکت جست‌وجو ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SearchRedirect"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${redirectId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'search.redirect.updated',
      'ریدایرکت جست‌وجو توسط ادمین به‌روزرسانی شد.',
      redirectId,
      actorId,
      {
        redirectId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      redirect: await this.findRedirect(redirectId, true),
    };
  }

  async deleteRedirect(redirectId: string, actorId?: string) {
    await this.findRedirectRow(redirectId, false);
    const deletedAt = await this.softDeleteTableRow(
      'SearchRedirect',
      redirectId,
    );

    await this.createSystemEvent(
      'search.redirect.deleted',
      'ریدایرکت جست‌وجو توسط ادمین حذف نرم شد.',
      redirectId,
      actorId,
      {
        redirectId,
      },
    );

    return {
      success: true,
      message: 'ریدایرکت جست‌وجو با موفقیت حذف شد.',
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTime(deletedAt),
    };
  }

  async restoreRedirect(redirectId: string, actorId?: string) {
    await this.findRedirectRow(redirectId, true);
    const restoredAt = await this.restoreTableRow('SearchRedirect', redirectId);

    await this.createSystemEvent(
      'search.redirect.restored',
      'ریدایرکت جست‌وجو توسط ادمین بازگردانی شد.',
      redirectId,
      actorId,
      {
        redirectId,
      },
    );

    return {
      redirect: await this.findRedirect(redirectId, true),
      restoredAt: restoredAt.toISOString(),
      restoredAtFa: this.formatDateTime(restoredAt),
    };
  }

  async findBoostRules(query: AdminSearchExportQueryDto) {
    const where = this.buildSimpleSearchWhere('b', query, [
      'entityType',
      'entityId',
      'query',
      'reason',
    ]);

    const rows = await this.prisma.$queryRaw<BoostRuleRow[]>(
      Prisma.sql`
          ${this.boostSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            b."weight" DESC,
            b."createdAt" DESC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapBoost(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createBoostRule(dto: AdminCreateSearchBoostRuleDto, actorId?: string) {
    this.assertDateRange(dto.startsAt, dto.endsAt);

    const boostId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SearchBoostRule" (
          "id",
          "entityType",
          "entityId",
          "query",
          "language",
          "weight",
          "reason",
          "isActive",
          "startsAt",
          "endsAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${boostId},
          ${dto.entityType},
          ${dto.entityId},
          ${dto.query ? this.normalizeQuery(dto.query) : null},
          ${this.normalizeLanguage(dto.language)},
          ${this.toDecimal(dto.weight ?? '1')},
          ${dto.reason ?? null},
          ${dto.isActive ?? true},
          ${dto.startsAt ? new Date(dto.startsAt) : null},
          ${dto.endsAt ? new Date(dto.endsAt) : null},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'search.boost.created',
      'قانون افزایش رتبه جست‌وجو توسط ادمین ایجاد شد.',
      boostId,
      actorId,
      {
        boostId,
        entityType: dto.entityType,
        entityId: dto.entityId,
      },
    );

    return {
      boostRule: await this.findBoostRule(boostId, true),
    };
  }

  async findBoostRule(boostId: string, includeDeleted = true) {
    const row = await this.findBoostRuleRow(boostId, includeDeleted);

    return this.mapBoost(row);
  }

  async updateBoostRule(
    boostId: string,
    dto: AdminUpdateSearchBoostRuleDto,
    actorId?: string,
  ) {
    await this.findBoostRuleRow(boostId, false);

    this.assertDateRange(dto.startsAt, dto.endsAt);

    const assignments: Prisma.Sql[] = [];

    if (dto.entityType !== undefined) {
      assignments.push(Prisma.sql`"entityType" = ${dto.entityType}`);
    }

    if (dto.entityId !== undefined) {
      assignments.push(Prisma.sql`"entityId" = ${dto.entityId}`);
    }

    if (dto.query !== undefined) {
      assignments.push(Prisma.sql`"query" = ${this.normalizeQuery(dto.query)}`);
    }

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.weight !== undefined) {
      assignments.push(Prisma.sql`"weight" = ${this.toDecimal(dto.weight)}`);
    }

    if (dto.reason !== undefined) {
      assignments.push(Prisma.sql`"reason" = ${dto.reason}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
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

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قانون افزایش رتبه ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "SearchBoostRule"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${boostId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'search.boost.updated',
      'قانون افزایش رتبه جست‌وجو توسط ادمین به‌روزرسانی شد.',
      boostId,
      actorId,
      {
        boostId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      boostRule: await this.findBoostRule(boostId, true),
    };
  }

  async deleteBoostRule(boostId: string, actorId?: string) {
    await this.findBoostRuleRow(boostId, false);
    const deletedAt = await this.softDeleteTableRow('SearchBoostRule', boostId);

    await this.createSystemEvent(
      'search.boost.deleted',
      'قانون افزایش رتبه جست‌وجو توسط ادمین حذف نرم شد.',
      boostId,
      actorId,
      {
        boostId,
      },
    );

    return {
      success: true,
      message: 'قانون افزایش رتبه با موفقیت حذف شد.',
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTime(deletedAt),
    };
  }

  async restoreBoostRule(boostId: string, actorId?: string) {
    await this.findBoostRuleRow(boostId, true);
    const restoredAt = await this.restoreTableRow('SearchBoostRule', boostId);

    await this.createSystemEvent(
      'search.boost.restored',
      'قانون افزایش رتبه جست‌وجو توسط ادمین بازگردانی شد.',
      boostId,
      actorId,
      {
        boostId,
      },
    );

    return {
      boostRule: await this.findBoostRule(boostId, true),
      restoredAt: restoredAt.toISOString(),
      restoredAtFa: this.formatDateTime(restoredAt),
    };
  }

  async runIndex(dto: AdminRunSearchIndexDto, actorId?: string) {
    const snapshotId = randomUUID();

    const startedAt = Date.now();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SearchIndexSnapshot" (
          "id",
          "indexName",
          "status",
          "documentCount",
          "metadata",
          "createdById",
          "startedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${snapshotId},
          ${dto.indexName},
          'RUNNING',
          0,
          ${JSON.stringify({
            force: dto.force ?? false,
            reason: dto.reason ?? null,
          })}::jsonb,
          ${actorId ?? null},
          ${now},
          ${now},
          ${now}
        )
      `,
    );

    try {
      const counts = await this.collectIndexCounts(dto.indexName);

      const documentCount = Object.values(counts).reduce(
        (sum, value) => sum + value,
        0,
      );

      const finishedAt = new Date();

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "SearchIndexSnapshot"
          SET
            "status" = 'SUCCESS',
            "documentCount" = ${documentCount},
            "durationMs" = ${Date.now() - startedAt},
            "metadata" = ${JSON.stringify({
              counts,
              force: dto.force ?? false,
              reason: dto.reason ?? null,
            })}::jsonb,
            "finishedAt" = ${finishedAt},
            "updatedAt" = ${finishedAt}
          WHERE "id" = ${snapshotId}
        `,
      );

      await this.createSystemEvent(
        'search.index.completed',
        'ایندکس جست‌وجو با موفقیت اجرا شد.',
        snapshotId,
        actorId,
        {
          snapshotId,
          indexName: dto.indexName,
          documentCount,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'خطای نامشخص در اجرای ایندکس جست‌وجو';

      const failedAt = new Date();

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "SearchIndexSnapshot"
          SET
            "status" = 'FAILED',
            "errorMessage" = ${message},
            "durationMs" = ${Date.now() - startedAt},
            "finishedAt" = ${failedAt},
            "updatedAt" = ${failedAt}
          WHERE "id" = ${snapshotId}
        `,
      );
    }

    return {
      snapshot: await this.findIndexSnapshot(snapshotId, true),
    };
  }

  async findIndexSnapshots(query: AdminSearchExportQueryDto) {
    const where = this.buildSimpleSearchWhere('i', query, [
      'indexName',
      'status',
      'errorMessage',
    ]);

    const rows = await this.prisma.$queryRaw<IndexSnapshotRow[]>(
      Prisma.sql`
          ${this.indexSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            i."startedAt" DESC,
            i."id" DESC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapIndexSnapshot(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async findIndexSnapshot(snapshotId: string, includeDeleted = true) {
    const where: Prisma.Sql[] = [Prisma.sql`i."id" = ${snapshotId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<IndexSnapshotRow[]>(
      Prisma.sql`
          ${this.indexSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const snapshot = rows[0];

    if (!snapshot) {
      throw new NotFoundException('اسنپ‌شات ایندکس جست‌وجو یافت نشد.');
    }

    return this.mapIndexSnapshot(snapshot);
  }

  async getNotes(entityKey: string, limit = 50) {
    const notes = await this.findNotes(entityKey, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        entityKey,
        total: notes.length,
      },
    };
  }

  async createNote(
    entityKey: string,
    dto: AdminSearchNoteDto,
    actorId?: string,
  ) {
    const noteId = await this.createSystemEvent(
      'search.note.created',
      'یادداشت مدیریتی برای جست‌وجو ثبت شد.',
      entityKey,
      actorId,
      {
        entityKey,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت جست‌وجو با موفقیت ثبت شد.',
    };
  }

  async findForExport(query: AdminSearchExportQueryDto) {
    const entity = query.entity ?? 'logs';

    if (entity === 'synonyms') {
      return (await this.findSynonyms(query)).data;
    }

    if (entity === 'redirects') {
      return (await this.findRedirects(query)).data;
    }

    if (entity === 'boost-rules') {
      return (await this.findBoostRules(query)).data;
    }

    if (entity === 'index-snapshots') {
      return (await this.findIndexSnapshots(query)).data;
    }

    return (
      await this.findLogs({
        page: 1,
        limit: 200,
        q: query.q,
        language: query.language,
      })
    ).data;
  }

  private logSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        l."id",
        l."query",
        l."normalizedQuery",
        l."language",
        l."userId",
        l."sessionId",
        l."source",
        l."resultCount",
        l."clickedEntityType",
        l."clickedEntityId",
        l."metadata",
        l."createdAt",
        l."deleted_at" AS "deletedAt"
      FROM "SearchQueryLog" l
    `;
  }

  private synonymSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        s."id",
        s."term",
        s."language",
        s."synonymsJson",
        s."isActive",
        s."createdAt",
        s."updatedAt",
        s."deleted_at" AS "deletedAt"
      FROM "SearchSynonym" s
    `;
  }

  private redirectSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        r."id",
        r."query",
        r."language",
        r."targetType",
        r."targetId",
        r."targetUrl",
        r."priority",
        r."isActive",
        r."startsAt",
        r."endsAt",
        r."createdAt",
        r."updatedAt",
        r."deleted_at" AS "deletedAt"
      FROM "SearchRedirect" r
    `;
  }

  private boostSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        b."id",
        b."entityType",
        b."entityId",
        b."query",
        b."language",
        b."weight",
        b."reason",
        b."isActive",
        b."startsAt",
        b."endsAt",
        b."createdAt",
        b."updatedAt",
        b."deleted_at" AS "deletedAt"
      FROM "SearchBoostRule" b
    `;
  }

  private indexSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        i."id",
        i."indexName",
        i."status",
        i."documentCount",
        i."durationMs",
        i."errorMessage",
        i."metadata",
        i."createdById",
        i."startedAt",
        i."finishedAt",
        i."createdAt",
        i."updatedAt",
        i."deleted_at" AS "deletedAt"
      FROM "SearchIndexSnapshot" i
    `;
  }

  private buildLogWhere(query: AdminQuerySearchLogDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`l."deleted_at" IS NULL`];

    if (query.q) {
      where.push(
        Prisma.sql`(
          l."query" ILIKE ${`%${query.q}%`}
          OR l."normalizedQuery" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.language) {
      where.push(
        Prisma.sql`l."language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`l."userId" = ${query.userId}`);
    }

    if (query.sessionId) {
      where.push(Prisma.sql`l."sessionId" = ${query.sessionId}`);
    }

    if (query.source) {
      where.push(Prisma.sql`l."source" = ${query.source}`);
    }

    if (query.zeroResultOnly === true) {
      where.push(Prisma.sql`l."resultCount" = 0`);
    }

    if (query.clickedOnly === true) {
      where.push(Prisma.sql`l."clickedEntityId" IS NOT NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`l."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`l."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildSimpleSearchWhere(
    alias: string,
    query: AdminSearchExportQueryDto,
    columns: string[],
  ): Prisma.Sql[] {
    const aliasSql = Prisma.raw(alias);

    const where: Prisma.Sql[] = [];

    if (query.includeDeleted === true) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`${aliasSql}."deleted_at" IS NULL`);
    }

    if (query.language) {
      where.push(
        Prisma.sql`${aliasSql}."language" = ${this.normalizeLanguage(query.language)}`,
      );
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${Prisma.join(
            columns.map(
              (column) =>
                Prisma.sql`${aliasSql}.${Prisma.raw(`"${column}"`)} ILIKE ${`%${query.q}%`}`,
            ),
            ' OR ',
          )}
        )`,
      );
    }

    return where;
  }

  private productSearchConditions(terms: string[]): Prisma.Sql {
    return Prisma.join(
      terms.map(
        (term) =>
          Prisma.sql`(
          p."name" ILIKE ${`%${term}%`}
          OR p."slug" ILIKE ${`%${term}%`}
          OR p."sku" ILIKE ${`%${term}%`}
          OR p."description" ILIKE ${`%${term}%`}
        )`,
      ),
      ' OR ',
    );
  }

  private categorySearchConditions(terms: string[]): Prisma.Sql {
    return Prisma.join(
      terms.map(
        (term) =>
          Prisma.sql`(
          c."name" ILIKE ${`%${term}%`}
          OR c."slug" ILIKE ${`%${term}%`}
          OR c."description" ILIKE ${`%${term}%`}
        )`,
      ),
      ' OR ',
    );
  }

  private brandSearchConditions(terms: string[]): Prisma.Sql {
    return Prisma.join(
      terms.map(
        (term) =>
          Prisma.sql`(
          bnd."name" ILIKE ${`%${term}%`}
          OR bnd."slug" ILIKE ${`%${term}%`}
          OR bnd."description" ILIKE ${`%${term}%`}
        )`,
      ),
      ' OR ',
    );
  }

  private async resolveSearchTerms(
    query: string,
    language: string,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<SynonymRow[]>(
      Prisma.sql`
          ${this.synonymSelectSql()}
          WHERE
            s."deleted_at" IS NULL
            AND s."isActive" = TRUE
            AND s."language" = ${language}
            AND LOWER(s."term") = LOWER(${query})
          LIMIT 1
        `,
    );

    const synonyms = this.toStringArray(rows[0]?.synonymsJson);

    return Array.from(
      new Set([query, ...synonyms.map((item) => this.normalizeQuery(item))]),
    ).filter((item) => item.length > 0);
  }

  private async findActiveRedirectByQuery(
    query: string,
    language: string,
  ): Promise<RedirectRow | null> {
    const rows = await this.prisma.$queryRaw<RedirectRow[]>(
      Prisma.sql`
          ${this.redirectSelectSql()}
          WHERE
            r."deleted_at" IS NULL
            AND r."isActive" = TRUE
            AND r."language" = ${language}
            AND LOWER(r."query") = LOWER(${query})
            AND (
              r."startsAt" IS NULL
              OR r."startsAt" <= NOW()
            )
            AND (
              r."endsAt" IS NULL
              OR r."endsAt" >= NOW()
            )
          ORDER BY
            r."priority" DESC,
            r."createdAt" DESC
          LIMIT 1
        `,
    );

    return rows[0] ?? null;
  }

  private async createSearchLog(
    query: string,
    language: string,
    resultCount: number,
    userId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "SearchQueryLog" (
          "id",
          "query",
          "normalizedQuery",
          "language",
          "userId",
          "source",
          "resultCount",
          "metadata",
          "createdAt"
        )
        VALUES (
          ${randomUUID()},
          ${query},
          ${query},
          ${language},
          ${userId ?? null},
          'ADMIN',
          ${resultCount},
          ${JSON.stringify(metadata)}::jsonb,
          ${now}
        )
      `,
    );
  }

  private async collectIndexCounts(
    indexName: string,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    if (
      indexName === 'all' ||
      indexName === 'catalog' ||
      indexName === 'products'
    ) {
      result.products = await this.countTable('Product', 'deleted_at');
    }

    if (
      indexName === 'all' ||
      indexName === 'catalog' ||
      indexName === 'categories'
    ) {
      result.categories = await this.countTable('Category', 'deleted_at');
    }

    if (
      indexName === 'all' ||
      indexName === 'catalog' ||
      indexName === 'brands'
    ) {
      result.brands = await this.countTable('Brand', 'deleted_at');
    }

    if (indexName === 'all' || indexName === 'content') {
      result.contentPages = await this.countTable('CmsPage', 'deleted_at');
    }

    return result;
  }

  private async countTable(
    tableName: string,
    deletedColumn: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM ${Prisma.raw(`"${tableName}"`)}
          WHERE ${Prisma.raw(`"${deletedColumn}"`)} IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private async findSynonymRow(
    synonymId: string,
    includeDeleted: boolean,
  ): Promise<SynonymRow> {
    const where: Prisma.Sql[] = [Prisma.sql`s."id" = ${synonymId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<SynonymRow[]>(
      Prisma.sql`
          ${this.synonymSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('مترادف جست‌وجو یافت نشد.');
    }

    return row;
  }

  private async findRedirectRow(
    redirectId: string,
    includeDeleted: boolean,
  ): Promise<RedirectRow> {
    const where: Prisma.Sql[] = [Prisma.sql`r."id" = ${redirectId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<RedirectRow[]>(
      Prisma.sql`
          ${this.redirectSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('ریدایرکت جست‌وجو یافت نشد.');
    }

    return row;
  }

  private async findBoostRuleRow(
    boostId: string,
    includeDeleted: boolean,
  ): Promise<BoostRuleRow> {
    const where: Prisma.Sql[] = [Prisma.sql`b."id" = ${boostId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`b."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<BoostRuleRow[]>(
      Prisma.sql`
          ${this.boostSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('قانون افزایش رتبه جست‌وجو یافت نشد.');
    }

    return row;
  }

  private async assertSynonymUnique(
    term: string,
    language: string,
    exceptId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("term") = LOWER(${term})`,
      Prisma.sql`"language" = ${language}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptId) {
      where.push(Prisma.sql`"id" <> ${exceptId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "SearchSynonym"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'مترادف جست‌وجو برای این عبارت و زبان تکراری است.',
      );
    }
  }

  private async assertRedirectUnique(
    query: string,
    language: string,
    exceptId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("query") = LOWER(${query})`,
      Prisma.sql`"language" = ${language}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptId) {
      where.push(Prisma.sql`"id" <> ${exceptId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "SearchRedirect"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'ریدایرکت جست‌وجو برای این عبارت و زبان تکراری است.',
      );
    }
  }

  private buildRedirectAssignments(
    dto: AdminUpdateSearchRedirectDto,
  ): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.query !== undefined) {
      assignments.push(Prisma.sql`"query" = ${this.normalizeQuery(dto.query)}`);
    }

    if (dto.language !== undefined) {
      assignments.push(
        Prisma.sql`"language" = ${this.normalizeLanguage(dto.language)}`,
      );
    }

    if (dto.targetType !== undefined) {
      assignments.push(Prisma.sql`"targetType" = ${dto.targetType}`);
    }

    if (dto.targetId !== undefined) {
      assignments.push(Prisma.sql`"targetId" = ${dto.targetId}`);
    }

    if (dto.targetUrl !== undefined) {
      assignments.push(Prisma.sql`"targetUrl" = ${dto.targetUrl}`);
    }

    if (dto.priority !== undefined) {
      assignments.push(Prisma.sql`"priority" = ${dto.priority}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
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

  private async softDeleteTableRow(
    tableName: string,
    rowId: string,
  ): Promise<Date> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${rowId}
          AND "deleted_at" IS NULL
      `,
    );

    return now;
  }

  private async restoreTableRow(
    tableName: string,
    rowId: string,
  ): Promise<Date> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${rowId}
      `,
    );

    return now;
  }

  private assertRedirectTarget(
    targetType: string,
    targetId?: string | null,
    targetUrl?: string | null,
  ): void {
    if (targetType === 'URL') {
      if (!targetUrl) {
        throw new BadRequestException(
          'برای ریدایرکت URL، آدرس مقصد الزامی است.',
        );
      }

      return;
    }

    if (!targetId) {
      throw new BadRequestException(
        'برای این نوع ریدایرکت، شناسه مقصد الزامی است.',
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

  private findNotes(entityKey: string, limit: number): Promise<EventRow[]> {
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
          AND "name" = 'search.note.created'
          AND "data" #>> '{entityKey}' = ${entityKey}
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

    const now = new Date();

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
          'search',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            entityId,
            ...data,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return eventId;
  }

  private mapSearchResult(row: SearchResultRow) {
    return {
      entityType: row.entityType,
      entityId: row.entityId,
      title: row.title,
      subtitle: row.subtitle,
      slug: row.slug,
      score: this.toDecimalString(row.score),
      status: row.status,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      updatedAtFa: this.formatDateTime(row.updatedAt),
    };
  }

  private mapLog(row: SearchLogRow) {
    return {
      id: row.id,
      query: row.query,
      normalizedQuery: row.normalizedQuery,
      language: row.language,
      userId: row.userId,
      sessionId: row.sessionId,
      source: row.source,
      resultCount: row.resultCount,
      clickedEntityType: row.clickedEntityType,
      clickedEntityId: row.clickedEntityId,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapSynonym(row: SynonymRow) {
    return {
      id: row.id,
      term: row.term,
      language: row.language,
      synonyms: this.toStringArray(row.synonymsJson),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapRedirect(row: RedirectRow) {
    return {
      id: row.id,
      query: row.query,
      language: row.language,
      targetType: row.targetType,
      targetId: row.targetId,
      targetUrl: row.targetUrl,
      priority: row.priority,
      isActive: row.isActive,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      startsAtFa: this.formatDateTime(row.startsAt),
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      endsAtFa: this.formatDateTime(row.endsAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapBoost(row: BoostRuleRow) {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      query: row.query,
      language: row.language,
      weight: this.toDecimalString(row.weight),
      reason: row.reason,
      isActive: row.isActive,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      startsAtFa: this.formatDateTime(row.startsAt),
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      endsAtFa: this.formatDateTime(row.endsAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapIndexSnapshot(row: IndexSnapshotRow) {
    return {
      id: row.id,
      indexName: row.indexName,
      status: row.status,
      documentCount: row.documentCount,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      metadata: row.metadata,
      createdById: row.createdById,
      startedAt: row.startedAt.toISOString(),
      startedAtFa: this.formatDateTime(row.startedAt),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      finishedAtFa: this.formatDateTime(row.finishedAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
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
      createdAtFa: this.formatDateTime(row.timestamp),
    };
  }

  private formatDateTime(value: Date | null | undefined): string | null {
    return formatPersianDateTime(value ?? null);
  }

  private normalizeQuery(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private normalizeLanguage(language?: string): string {
    return language?.trim().toLowerCase() || 'fa';
  }

  private normalizeStringArray(values: string[]): string[] {
    return Array.from(
      new Set(
        values
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length > 0),
      ),
    );
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

  private toDecimal(value: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('مقدار عددی معتبر نیست.');
    }
  }

  private toDecimalString(value: unknown): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Prisma.Decimal(value).toFixed(2);
    }

    if (typeof value === 'bigint') {
      return new Prisma.Decimal(value.toString()).toFixed(2);
    }

    throw new TypeError('Unsupported decimal value.');
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
