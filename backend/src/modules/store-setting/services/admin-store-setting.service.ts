import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminBulkUpdateStoreSettingsDto } from '../dto/admin-bulk-update-store-settings.dto';

import { AdminCreateStoreSettingDto } from '../dto/admin-create-store-setting.dto';

import {
  AdminQueryStoreSettingDto,
  AdminStoreSettingType,
} from '../dto/admin-query-store-setting.dto';

import { AdminStoreSettingNoteDto } from '../dto/admin-store-setting-note.dto';

import { AdminUpdateStoreSettingDto } from '../dto/admin-update-store-setting.dto';

type CountRow = {
  count: number | bigint;
};

type StoreSettingRow = {
  id: string;
  key: string;
  group: string;
  type: string;
  label: string;
  description: string | null;
  valueJson: unknown;
  valueText: string | null;
  defaultValueJson: unknown;
  validationJson: unknown;
  isPublic: boolean;
  isReadonly: boolean;
  isActive: boolean;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type StoreSettingRevisionRow = {
  id: string;
  settingId: string;
  key: string;
  previousValueJson: unknown;
  nextValueJson: unknown;
  actorId: string | null;
  reason: string | null;
  createdAt: Date;
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

type NormalizedSettingValue = {
  valueJson: unknown;
  valueText: string;
};

@Injectable()
export class AdminStoreSettingService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryStoreSettingDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<StoreSettingRow[]>(
        Prisma.sql`
            ${this.selectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              s."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "StoreSetting" s
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapSetting(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(settingId: string, includeDeleted = true) {
    const setting = await this.findSettingRow(settingId, includeDeleted);

    const [revisions, notes] = await Promise.all([
      this.findRevisions(setting.id, 10),
      this.findNotes(setting.id, 20),
    ]);

    return {
      ...this.mapSetting(setting),
      revisions: revisions.map((revision) => this.mapRevision(revision)),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async findByKey(key: string, includeDeleted = true) {
    const setting = await this.findSettingByKeyRow(key, includeDeleted);

    return this.findOne(setting.id, includeDeleted);
  }

  async getPublicSettings() {
    const rows = await this.prisma.$queryRaw<StoreSettingRow[]>(
      Prisma.sql`
          ${this.selectSql()}
          WHERE
            s."deleted_at" IS NULL
            AND s."isActive" = TRUE
            AND s."isPublic" = TRUE
          ORDER BY
            s."group" ASC,
            s."key" ASC
        `,
    );

    return {
      data: rows.map((row) => ({
        key: row.key,
        group: row.group,
        type: row.type,
        label: row.label,
        value: row.valueJson,
      })),
      meta: {
        total: rows.length,
      },
    };
  }

  async getGroups() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        group: string;
        total: number | bigint;
        active: number | bigint;
        public: number | bigint;
        readonly: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            s."group",
            COUNT(*)::int AS "total",
            COUNT(*) FILTER (WHERE s."isActive" = TRUE)::int AS "active",
            COUNT(*) FILTER (WHERE s."isPublic" = TRUE)::int AS "public",
            COUNT(*) FILTER (WHERE s."isReadonly" = TRUE)::int AS "readonly"
          FROM "StoreSetting" s
          WHERE s."deleted_at" IS NULL
          GROUP BY s."group"
          ORDER BY s."group" ASC
        `,
    );

    return {
      data: rows.map((row) => ({
        group: row.group,
        total: this.toNumber(row.total),
        active: this.toNumber(row.active),
        public: this.toNumber(row.public),
        readonly: this.toNumber(row.readonly),
      })),
      meta: {
        total: rows.length,
      },
    };
  }

  async getDashboard() {
    const rows = await this.prisma.$queryRaw<
      Array<{
        total: number | bigint;
        active: number | bigint;
        inactive: number | bigint;
        public: number | bigint;
        readonly: number | bigint;
        deleted: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE "deleted_at" IS NULL)::int AS "total",
            COUNT(*) FILTER (
              WHERE "deleted_at" IS NULL AND "isActive" = TRUE
            )::int AS "active",
            COUNT(*) FILTER (
              WHERE "deleted_at" IS NULL AND "isActive" = FALSE
            )::int AS "inactive",
            COUNT(*) FILTER (
              WHERE "deleted_at" IS NULL AND "isPublic" = TRUE
            )::int AS "public",
            COUNT(*) FILTER (
              WHERE "deleted_at" IS NULL AND "isReadonly" = TRUE
            )::int AS "readonly",
            COUNT(*) FILTER (WHERE "deleted_at" IS NOT NULL)::int AS "deleted"
          FROM "StoreSetting"
        `,
    );

    const row = rows[0];

    return {
      total: this.toNumber(row?.total),
      active: this.toNumber(row?.active),
      inactive: this.toNumber(row?.inactive),
      public: this.toNumber(row?.public),
      readonly: this.toNumber(row?.readonly),
      deleted: this.toNumber(row?.deleted),
    };
  }

  async create(dto: AdminCreateStoreSettingDto, actorId?: string) {
    const key = this.normalizeKey(dto.key);

    await this.assertKeyUnique(key);

    const normalized = this.normalizeValue(dto.type, dto.value);

    const defaultValue =
      dto.defaultValue === undefined
        ? null
        : this.normalizeValue(dto.type, dto.defaultValue).valueJson;

    const settingId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "StoreSetting" (
          "id",
          "key",
          "group",
          "type",
          "label",
          "description",
          "valueJson",
          "valueText",
          "defaultValueJson",
          "validationJson",
          "isPublic",
          "isReadonly",
          "isActive",
          "updatedById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${settingId},
          ${key},
          ${dto.group ?? 'GENERAL'},
          ${dto.type},
          ${dto.label},
          ${dto.description ?? null},
          ${JSON.stringify(normalized.valueJson)}::jsonb,
          ${normalized.valueText},
          ${defaultValue === null ? null : JSON.stringify(defaultValue)}::jsonb,
          ${JSON.stringify(dto.validation ?? {})}::jsonb,
          ${dto.isPublic ?? false},
          ${dto.isReadonly ?? false},
          ${dto.isActive ?? true},
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'store_setting.created',
      'تنظیم فروشگاه توسط ادمین ایجاد شد.',
      settingId,
      actorId,
      {
        key,
        group: dto.group ?? 'GENERAL',
        type: dto.type,
      },
    );

    return {
      setting: await this.findOne(settingId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'store_setting.created',
      },
    };
  }

  async update(
    settingId: string,
    dto: AdminUpdateStoreSettingDto,
    actorId?: string,
  ) {
    const current = await this.findSettingRow(settingId, false);

    return this.updateSettingRow(current, dto, actorId);
  }

  async updateByKey(
    key: string,
    dto: AdminUpdateStoreSettingDto,
    actorId?: string,
  ) {
    const current = await this.findSettingByKeyRow(key, false);

    return this.updateSettingRow(current, dto, actorId);
  }

  async bulkUpdate(dto: AdminBulkUpdateStoreSettingsDto, actorId?: string) {
    if (dto.items.length === 0) {
      throw new BadRequestException('لیست تنظیمات برای به‌روزرسانی خالی است.');
    }

    const results: Array<{
      key: string;
      success: boolean;
      settingId?: string;
    }> = [];

    for (const item of dto.items) {
      const current = await this.findSettingByKeyRow(item.key, false);

      const normalized = this.normalizeValue(
        current.type as AdminStoreSettingType,
        item.value,
      );

      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "StoreSetting"
          SET
            "valueJson" = ${JSON.stringify(normalized.valueJson)}::jsonb,
            "valueText" = ${normalized.valueText},
            "updatedById" = ${actorId ?? null},
            "updatedAt" = NOW()
          WHERE
            "id" = ${current.id}
            AND "deleted_at" IS NULL
        `,
      );

      await this.createRevision(
        current,
        normalized.valueJson,
        actorId,
        dto.reason ?? 'به‌روزرسانی گروهی تنظیمات',
      );

      results.push({
        key: current.key,
        success: true,
        settingId: current.id,
      });
    }

    await this.createSystemEvent(
      'store_setting.bulk_updated',
      'تنظیمات فروشگاه به‌صورت گروهی به‌روزرسانی شد.',
      'bulk',
      actorId,
      {
        count: results.length,
        keys: results.map((result) => result.key),
      },
    );

    return {
      success: true,
      results,
    };
  }

  async delete(settingId: string, actorId?: string) {
    const setting = await this.findSettingRow(settingId, false);

    if (setting.isReadonly) {
      throw new BadRequestException('تنظیم سیستمی قابل حذف نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "StoreSetting"
        SET
          "deleted_at" = NOW(),
          "isActive" = FALSE,
          "updatedById" = ${actorId ?? null},
          "updatedAt" = NOW()
        WHERE
          "id" = ${settingId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'store_setting.deleted',
      'تنظیم فروشگاه توسط ادمین حذف نرم شد.',
      settingId,
      actorId,
      {
        key: setting.key,
      },
    );

    return {
      success: true,
      message: 'تنظیم فروشگاه با موفقیت حذف شد.',
    };
  }

  async restore(settingId: string, actorId?: string) {
    const setting = await this.findSettingRow(settingId, true);

    await this.assertKeyUnique(setting.key, setting.id);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "StoreSetting"
        SET
          "deleted_at" = NULL,
          "updatedById" = ${actorId ?? null},
          "updatedAt" = NOW()
        WHERE "id" = ${settingId}
      `,
    );

    await this.createSystemEvent(
      'store_setting.restored',
      'تنظیم فروشگاه حذف‌شده توسط ادمین بازگردانی شد.',
      settingId,
      actorId,
      {
        key: setting.key,
      },
    );

    return {
      setting: await this.findOne(settingId, true),
    };
  }

  async getRevisions(settingId: string, limit = 50) {
    await this.findSettingRow(settingId, true);

    const rows = await this.findRevisions(settingId, limit);

    return {
      data: rows.map((row) => this.mapRevision(row)),
      meta: {
        settingId,
        total: rows.length,
      },
    };
  }

  async getNotes(settingId: string, limit = 50) {
    await this.findSettingRow(settingId, true);

    const notes = await this.findNotes(settingId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        settingId,
        total: notes.length,
      },
    };
  }

  async createNote(
    settingId: string,
    dto: AdminStoreSettingNoteDto,
    actorId?: string,
  ) {
    const setting = await this.findSettingRow(settingId, true);

    const noteId = await this.createSystemEvent(
      'store_setting.note.created',
      'یادداشت مدیریتی برای تنظیم فروشگاه ثبت شد.',
      settingId,
      actorId,
      {
        settingId,
        key: setting.key,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت تنظیم فروشگاه با موفقیت ثبت شد.',
    };
  }

  async bootstrapDefaults(actorId?: string) {
    const defaults: AdminCreateStoreSettingDto[] = [
      {
        key: 'store.name',
        label: 'نام فروشگاه',
        group: 'BUSINESS',
        type: 'STRING',
        value: 'وکسو بیوتی',
        isPublic: true,
        isReadonly: false,
        isActive: true,
      },
      {
        key: 'store.currency',
        label: 'واحد پول پیش‌فرض',
        group: 'GENERAL',
        type: 'STRING',
        value: 'IRR',
        isPublic: true,
        isReadonly: true,
        isActive: true,
      },
      {
        key: 'seo.default_title',
        label: 'عنوان پیش‌فرض سئو',
        group: 'SEO',
        type: 'STRING',
        value: 'فروشگاه وکسو بیوتی',
        isPublic: true,
        isReadonly: false,
        isActive: true,
      },
      {
        key: 'shipping.free_shipping_threshold',
        label: 'حداقل مبلغ ارسال رایگان',
        group: 'SHIPPING',
        type: 'NUMBER',
        value: 0,
        isPublic: true,
        isReadonly: false,
        isActive: true,
      },
      {
        key: 'payment.cod_enabled',
        label: 'فعال بودن پرداخت در محل',
        group: 'PAYMENT',
        type: 'BOOLEAN',
        value: false,
        isPublic: false,
        isReadonly: false,
        isActive: true,
      },
    ];

    const results: Array<{
      key: string;
      created: boolean;
    }> = [];

    for (const item of defaults) {
      const exists = await this.existsByKey(item.key);

      if (exists) {
        results.push({
          key: item.key,
          created: false,
        });

        continue;
      }

      await this.create(item, actorId);

      results.push({
        key: item.key,
        created: true,
      });
    }

    return {
      success: true,
      results,
    };
  }

  async findForExport(query: AdminQueryStoreSettingDto) {
    const where = this.buildWhere(query);

    const rows = await this.prisma.$queryRaw<StoreSettingRow[]>(
      Prisma.sql`
          ${this.selectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            s."group" ASC,
            s."key" ASC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapSetting(row));
  }

  private async updateSettingRow(
    current: StoreSettingRow,
    dto: AdminUpdateStoreSettingDto,
    actorId?: string,
  ) {
    if (current.isReadonly && dto.force !== true) {
      throw new BadRequestException(
        'این تنظیم سیستمی است و برای ویرایش آن باید force ارسال شود.',
      );
    }

    const nextType = dto.type ?? current.type;

    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      const key = this.normalizeKey(dto.key);

      if (key !== current.key) {
        await this.assertKeyUnique(key, current.id);
      }

      assignments.push(Prisma.sql`"key" = ${key}`);
    }

    if (dto.group !== undefined) {
      assignments.push(Prisma.sql`"group" = ${dto.group}`);
    }

    if (dto.type !== undefined) {
      assignments.push(Prisma.sql`"type" = ${dto.type}`);
    }

    if (dto.label !== undefined) {
      assignments.push(Prisma.sql`"label" = ${dto.label}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    let nextValueForRevision: unknown;

    if (dto.value !== undefined || dto.type !== undefined) {
      const value = dto.value !== undefined ? dto.value : current.valueJson;

      const normalized = this.normalizeValue(
        nextType as AdminStoreSettingType,
        value,
      );

      assignments.push(
        Prisma.sql`"valueJson" = ${JSON.stringify(normalized.valueJson)}::jsonb`,
      );

      assignments.push(Prisma.sql`"valueText" = ${normalized.valueText}`);

      nextValueForRevision = normalized.valueJson;
    }

    if (dto.defaultValue !== undefined) {
      const normalizedDefault = this.normalizeValue(
        nextType as AdminStoreSettingType,
        dto.defaultValue,
      );

      assignments.push(
        Prisma.sql`"defaultValueJson" = ${JSON.stringify(normalizedDefault.valueJson)}::jsonb`,
      );
    }

    if (dto.validation !== undefined) {
      assignments.push(
        Prisma.sql`"validationJson" = ${JSON.stringify(dto.validation)}::jsonb`,
      );
    }

    if (dto.isPublic !== undefined) {
      assignments.push(Prisma.sql`"isPublic" = ${dto.isPublic}`);
    }

    if (dto.isReadonly !== undefined) {
      assignments.push(Prisma.sql`"isReadonly" = ${dto.isReadonly}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی تنظیم فروشگاه ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "StoreSetting"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedById" = ${actorId ?? null},
          "updatedAt" = NOW()
        WHERE
          "id" = ${current.id}
          AND "deleted_at" IS NULL
      `,
    );

    if (nextValueForRevision !== undefined) {
      await this.createRevision(
        current,
        nextValueForRevision,
        actorId,
        dto.reason ?? null,
      );
    }

    await this.createSystemEvent(
      'store_setting.updated',
      'تنظیم فروشگاه توسط ادمین به‌روزرسانی شد.',
      current.id,
      actorId,
      {
        key: dto.key ? this.normalizeKey(dto.key) : current.key,
        changedFields: Object.keys(dto),
      },
    );

    return {
      setting: await this.findOne(current.id, true),
      audit: {
        actorId: actorId ?? null,
        action: 'store_setting.updated',
      },
    };
  }

  private selectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        s."id",
        s."key",
        s."group",
        s."type",
        s."label",
        s."description",
        s."valueJson",
        s."valueText",
        s."defaultValueJson",
        s."validationJson",
        s."isPublic",
        s."isReadonly",
        s."isActive",
        s."updatedById",
        s."createdAt",
        s."updatedAt",
        s."deleted_at" AS "deletedAt"
      FROM "StoreSetting" s
    `;
  }

  private buildWhere(query: AdminQueryStoreSettingDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          s."key" ILIKE ${`%${query.q}%`}
          OR s."label" ILIKE ${`%${query.q}%`}
          OR s."description" ILIKE ${`%${query.q}%`}
          OR s."valueText" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.settingId) {
      where.push(Prisma.sql`s."id" = ${query.settingId}`);
    }

    if (query.key) {
      where.push(
        Prisma.sql`s."key" ILIKE ${`%${this.normalizeKey(query.key)}%`}`,
      );
    }

    if (query.group) {
      where.push(Prisma.sql`s."group" = ${query.group}`);
    }

    if (query.type) {
      where.push(Prisma.sql`s."type" = ${query.type}`);
    }

    if (query.isPublic !== undefined) {
      where.push(Prisma.sql`s."isPublic" = ${query.isPublic}`);
    }

    if (query.isReadonly !== undefined) {
      where.push(Prisma.sql`s."isReadonly" = ${query.isReadonly}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`s."isActive" = ${query.isActive}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`s."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`s."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.updatedFrom) {
      where.push(Prisma.sql`s."updatedAt" >= ${new Date(query.updatedFrom)}`);
    }

    if (query.updatedTo) {
      where.push(Prisma.sql`s."updatedAt" <= ${new Date(query.updatedTo)}`);
    }

    return where;
  }

  private async findSettingRow(
    settingId: string,
    includeDeleted: boolean,
  ): Promise<StoreSettingRow> {
    const where: Prisma.Sql[] = [Prisma.sql`s."id" = ${settingId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<StoreSettingRow[]>(
      Prisma.sql`
          ${this.selectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const setting = rows[0];

    if (!setting) {
      throw new NotFoundException('تنظیم فروشگاه موردنظر یافت نشد.');
    }

    return setting;
  }

  private async findSettingByKeyRow(
    key: string,
    includeDeleted: boolean,
  ): Promise<StoreSettingRow> {
    const normalizedKey = this.normalizeKey(key);

    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER(s."key") = LOWER(${normalizedKey})`,
    ];

    if (!includeDeleted) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<StoreSettingRow[]>(
      Prisma.sql`
          ${this.selectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const setting = rows[0];

    if (!setting) {
      throw new NotFoundException('تنظیم فروشگاه موردنظر یافت نشد.');
    }

    return setting;
  }

  private async existsByKey(key: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "StoreSetting"
          WHERE
            LOWER("key") = LOWER(${this.normalizeKey(key)})
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count) > 0;
  }

  private async assertKeyUnique(
    key: string,
    exceptSettingId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("key") = LOWER(${key})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptSettingId) {
      where.push(Prisma.sql`"id" <> ${exceptSettingId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "StoreSetting"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کلید تنظیم فروشگاه تکراری است.');
    }
  }

  private async createRevision(
    current: StoreSettingRow,
    nextValueJson: unknown,
    actorId: string | undefined,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "StoreSettingRevision" (
          "id",
          "settingId",
          "key",
          "previousValueJson",
          "nextValueJson",
          "actorId",
          "reason",
          "createdAt"
        )
        VALUES (
          ${randomUUID()},
          ${current.id},
          ${current.key},
          ${JSON.stringify(current.valueJson)}::jsonb,
          ${JSON.stringify(nextValueJson)}::jsonb,
          ${actorId ?? null},
          ${reason},
          NOW()
        )
      `,
    );
  }

  private findRevisions(
    settingId: string,
    limit: number,
  ): Promise<StoreSettingRevisionRow[]> {
    return this.prisma.$queryRaw<StoreSettingRevisionRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "settingId",
          "key",
          "previousValueJson",
          "nextValueJson",
          "actorId",
          "reason",
          "createdAt"
        FROM "StoreSettingRevision"
        WHERE "settingId" = ${settingId}
        ORDER BY "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private findNotes(settingId: string, limit: number): Promise<EventRow[]> {
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
          AND "name" = 'store_setting.note.created'
          AND "data" #>> '{settingId}' = ${settingId}
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
    settingId: string,
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
          'store-setting',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            settingId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private normalizeValue(
    type: AdminStoreSettingType,
    value: unknown,
  ): NormalizedSettingValue {
    if (type === 'BOOLEAN') {
      const parsed = this.parseBooleanValue(value);

      return {
        valueJson: parsed,
        valueText: parsed ? 'true' : 'false',
      };
    }

    if (type === 'NUMBER') {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        throw new BadRequestException('مقدار تنظیم عددی معتبر نیست.');
      }

      return {
        valueJson: parsed,
        valueText: String(parsed),
      };
    }

    if (type === 'ARRAY') {
      if (!Array.isArray(value)) {
        throw new BadRequestException('مقدار تنظیم آرایه‌ای باید لیست باشد.');
      }

      return {
        valueJson: value,
        valueText: JSON.stringify(value),
      };
    }

    if (type === 'JSON') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException(
          'مقدار تنظیم JSON باید آبجکت معتبر باشد.',
        );
      }

      return {
        valueJson: value,
        valueText: JSON.stringify(value),
      };
    }

    let text = '';

    if (value !== null && value !== undefined) {
      if (typeof value !== 'string') {
        throw new BadRequestException('مقدار تنظیم متنی باید رشته باشد.');
      }

      text = value.trim();
    }

    if (type === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw new BadRequestException('مقدار ایمیل معتبر نیست.');
    }

    if (type === 'URL') {
      this.assertUrl(text);
    }

    return {
      valueJson: text,
      valueText: text,
    };
  }

  private parseBooleanValue(value: unknown): boolean {
    if (value === true) {
      return true;
    }

    if (value === false) {
      return false;
    }

    if (value === 'true' || value === '1' || value === 1) {
      return true;
    }

    if (value === 'false' || value === '0' || value === 0) {
      return false;
    }

    throw new BadRequestException('مقدار تنظیم بولی معتبر نیست.');
  }

  private assertUrl(value: string): void {
    try {
      new URL(value);
    } catch {
      throw new BadRequestException('آدرس URL معتبر نیست.');
    }
  }

  private mapSetting(row: StoreSettingRow) {
    return {
      id: row.id,
      key: row.key,
      group: row.group,
      type: row.type,
      label: row.label,
      description: row.description,
      value: row.valueJson,
      valueText: row.valueText,
      defaultValue: row.defaultValueJson,
      validation: row.validationJson,
      flags: {
        isPublic: row.isPublic,
        isReadonly: row.isReadonly,
        isActive: row.isActive,
      },
      updatedById: row.updatedById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapRevision(row: StoreSettingRevisionRow) {
    return {
      id: row.id,
      settingId: row.settingId,
      key: row.key,
      previousValue: row.previousValueJson,
      nextValue: row.nextValueJson,
      actorId: row.actorId,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
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

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`s."updatedAt"`;
    }

    if (sortBy === 'key') {
      return Prisma.sql`s."key"`;
    }

    if (sortBy === 'group') {
      return Prisma.sql`s."group"`;
    }

    if (sortBy === 'type') {
      return Prisma.sql`s."type"`;
    }

    if (sortBy === 'label') {
      return Prisma.sql`s."label"`;
    }

    if (sortBy === 'isPublic') {
      return Prisma.sql`s."isPublic"`;
    }

    if (sortBy === 'isReadonly') {
      return Prisma.sql`s."isReadonly"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`s."isActive"`;
    }

    return Prisma.sql`s."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
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

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
