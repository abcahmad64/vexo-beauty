import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateAddressDto } from '../dto/admin-create-address.dto';
import { AdminQueryAddressDto } from '../dto/admin-query-address.dto';
import { AdminUpdateAddressDto } from '../dto/admin-update-address.dto';

type CountRow = {
  count: number | bigint;
};

type AddressRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userStatus: string | null;
  title: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  street: string;
  apartment: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class AdminAddressService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryAddressDto): Promise<unknown> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildAddressWhere(query, 'a');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AddressRow[]>(
        Prisma.sql`
          SELECT
            a."id",
            a."userId",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            u."firstName" AS "userFirstName",
            u."lastName" AS "userLastName",
            u."status"::text AS "userStatus",
            a."title",
            a."firstName",
            a."lastName",
            a."phone",
            a."country",
            a."state",
            a."city",
            a."postalCode",
            a."street",
            a."apartment",
            a."isDefault",
            a."createdAt",
            a."updatedAt",
            a."deleted_at" AS "deletedAt"
          FROM "Address" a
          INNER JOIN "User" u
            ON u."id" = a."userId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            ${this.resolveSortColumn(query.sortBy)}
            ${this.resolveSortDirection(query.sortDirection)},
            a."id" DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Address" a
          INNER JOIN "User" u
            ON u."id" = a."userId"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapAddress(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(addressId: string): Promise<unknown> {
    const address = await this.findAddressRow(addressId, true);

    return this.mapAddress(address);
  }

  async create(dto: AdminCreateAddressDto, actorId?: string): Promise<unknown> {
    await this.assertUserExists(dto.userId);

    const addressId = randomUUID();

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await this.clearDefaultAddressTx(tx, dto.userId, undefined, now);
      }

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "Address" (
            "id",
            "userId",
            "title",
            "firstName",
            "lastName",
            "phone",
            "country",
            "state",
            "city",
            "postalCode",
            "street",
            "apartment",
            "isDefault",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${addressId},
            ${dto.userId},
            ${dto.title ?? null},
            ${dto.firstName},
            ${dto.lastName},
            ${dto.phone},
            ${dto.country},
            ${dto.state ?? null},
            ${dto.city},
            ${dto.postalCode ?? null},
            ${dto.street},
            ${dto.apartment ?? null},
            ${dto.isDefault ?? false},
            ${now},
            ${now}
          )
        `,
      );
    });

    return {
      address: await this.findOne(addressId),
      createdAt: now,
      createdAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.admin_created',
      },
    };
  }

  async update(
    addressId: string,
    dto: AdminUpdateAddressDto,
    actorId?: string,
  ): Promise<unknown> {
    const current = await this.findAddressRow(addressId, true);

    if (dto.userId !== undefined) {
      await this.assertUserExists(dto.userId);
    }

    const nextUserId = dto.userId ?? current.userId;

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی آدرس ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await this.clearDefaultAddressTx(tx, nextUserId, addressId, now);
      }

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "Address"
          SET
            ${Prisma.join(assignments, ', ')},
            "updatedAt" = ${now}
          WHERE
            "id" = ${addressId}
            AND "deleted_at" IS NULL
        `,
      );
    });

    return {
      address: await this.findOne(addressId),
      updatedAt: now,
      updatedAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.admin_updated',
      },
    };
  }

  async setDefault(addressId: string, actorId?: string): Promise<unknown> {
    const address = await this.findAddressRow(addressId, true);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.clearDefaultAddressTx(tx, address.userId, addressId, now);

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "Address"
          SET
            "isDefault" = TRUE,
            "updatedAt" = ${now}
          WHERE
            "id" = ${addressId}
            AND "deleted_at" IS NULL
        `,
      );
    });

    return {
      address: await this.findOne(addressId),
      updatedAt: now,
      updatedAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.default_set',
      },
    };
  }

  async unsetDefault(addressId: string, actorId?: string): Promise<unknown> {
    await this.findAddressRow(addressId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Address"
        SET
          "isDefault" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${addressId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      address: await this.findOne(addressId),
      updatedAt: now,
      updatedAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.default_unset',
      },
    };
  }

  async delete(addressId: string, actorId?: string): Promise<unknown> {
    await this.findAddressRow(addressId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Address"
        SET
          "deleted_at" = ${now},
          "isDefault" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${addressId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'آدرس با موفقیت حذف شد.',
      deletedAt: now,
      deletedAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.admin_deleted',
      },
    };
  }

  async restore(addressId: string, actorId?: string): Promise<unknown> {
    await this.findAddressRow(addressId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Address"
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${addressId}
      `,
    );

    return {
      address: await this.findOne(addressId),
      restoredAt: now,
      restoredAtFa: this.formatDate(now),
      audit: {
        actorId: actorId ?? null,
        action: 'address.admin_restored',
      },
    };
  }

  async findAddressRow(
    addressId: string,
    includeDeleted: boolean,
  ): Promise<AddressRow> {
    const where: Prisma.Sql[] = [Prisma.sql`a."id" = ${addressId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`a."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AddressRow[]>(
      Prisma.sql`
        SELECT
          a."id",
          a."userId",
          u."email" AS "userEmail",
          u."phone" AS "userPhone",
          u."firstName" AS "userFirstName",
          u."lastName" AS "userLastName",
          u."status"::text AS "userStatus",
          a."title",
          a."firstName",
          a."lastName",
          a."phone",
          a."country",
          a."state",
          a."city",
          a."postalCode",
          a."street",
          a."apartment",
          a."isDefault",
          a."createdAt",
          a."updatedAt",
          a."deleted_at" AS "deletedAt"
        FROM "Address" a
        INNER JOIN "User" u
          ON u."id" = a."userId"
        WHERE ${Prisma.join(where, ' AND ')}
        LIMIT 1
      `,
    );

    const address = rows[0];

    if (!address) {
      throw new NotFoundException('آدرس موردنظر یافت نشد.');
    }

    return address;
  }

  private buildAddressWhere(
    query: AdminQueryAddressDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."title" ILIKE ${`%${query.q}%`}
          OR ${table}."firstName" ILIKE ${`%${query.q}%`}
          OR ${table}."lastName" ILIKE ${`%${query.q}%`}
          OR ${table}."phone" ILIKE ${`%${query.q}%`}
          OR ${table}."country" ILIKE ${`%${query.q}%`}
          OR ${table}."state" ILIKE ${`%${query.q}%`}
          OR ${table}."city" ILIKE ${`%${query.q}%`}
          OR ${table}."postalCode" ILIKE ${`%${query.q}%`}
          OR ${table}."street" ILIKE ${`%${query.q}%`}
          OR ${table}."apartment" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`${table}."userId" = ${query.userId}`);
    }

    if (query.email) {
      where.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.phone) {
      where.push(
        Prisma.sql`(
          ${table}."phone" ILIKE ${`%${query.phone}%`}
          OR u."phone" ILIKE ${`%${query.phone}%`}
        )`,
      );
    }

    if (query.country) {
      where.push(Prisma.sql`${table}."country" ILIKE ${`%${query.country}%`}`);
    }

    if (query.state) {
      where.push(Prisma.sql`${table}."state" ILIKE ${`%${query.state}%`}`);
    }

    if (query.city) {
      where.push(Prisma.sql`${table}."city" ILIKE ${`%${query.city}%`}`);
    }

    if (query.postalCode) {
      where.push(
        Prisma.sql`${table}."postalCode" ILIKE ${`%${query.postalCode}%`}`,
      );
    }

    if (query.isDefault !== undefined) {
      where.push(Prisma.sql`${table}."isDefault" = ${query.isDefault}`);
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${new Date(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${new Date(query.createdTo)}`,
      );
    }

    return where;
  }

  private buildUpdateAssignments(dto: AdminUpdateAddressDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.userId !== undefined) {
      assignments.push(Prisma.sql`"userId" = ${dto.userId}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.firstName !== undefined) {
      assignments.push(Prisma.sql`"firstName" = ${dto.firstName}`);
    }

    if (dto.lastName !== undefined) {
      assignments.push(Prisma.sql`"lastName" = ${dto.lastName}`);
    }

    if (dto.phone !== undefined) {
      assignments.push(Prisma.sql`"phone" = ${dto.phone}`);
    }

    if (dto.country !== undefined) {
      assignments.push(Prisma.sql`"country" = ${dto.country}`);
    }

    if (dto.state !== undefined) {
      assignments.push(Prisma.sql`"state" = ${dto.state}`);
    }

    if (dto.city !== undefined) {
      assignments.push(Prisma.sql`"city" = ${dto.city}`);
    }

    if (dto.postalCode !== undefined) {
      assignments.push(Prisma.sql`"postalCode" = ${dto.postalCode}`);
    }

    if (dto.street !== undefined) {
      assignments.push(Prisma.sql`"street" = ${dto.street}`);
    }

    if (dto.apartment !== undefined) {
      assignments.push(Prisma.sql`"apartment" = ${dto.apartment}`);
    }

    if (dto.isDefault !== undefined) {
      assignments.push(Prisma.sql`"isDefault" = ${dto.isDefault}`);
    }

    return assignments;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "count"
        FROM "User"
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('کاربر انتخاب‌شده برای آدرس معتبر نیست.');
    }
  }

  private async clearDefaultAddressTx(
    tx: Prisma.TransactionClient,
    userId: string,
    exceptAddressId?: string,
    updatedAt?: Date,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptAddressId) {
      where.push(Prisma.sql`"id" <> ${exceptAddressId}`);
    }

    const now = updatedAt ?? new Date();

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Address"
        SET
          "isDefault" = FALSE,
          "updatedAt" = ${now}
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private mapAddress(row: AddressRow) {
    return {
      id: row.id,
      user: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
        status: row.userStatus,
      },
      title: row.title,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      phone: row.phone,
      country: row.country,
      state: row.state,
      city: row.city,
      postalCode: row.postalCode,
      street: row.street,
      apartment: row.apartment,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDate(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDate(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDate(row.deletedAt),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`a."updatedAt"`;
    }

    if (sortBy === 'city') {
      return Prisma.sql`a."city"`;
    }

    if (sortBy === 'country') {
      return Prisma.sql`a."country"`;
    }

    if (sortBy === 'firstName') {
      return Prisma.sql`a."firstName"`;
    }

    if (sortBy === 'lastName') {
      return Prisma.sql`a."lastName"`;
    }

    if (sortBy === 'postalCode') {
      return Prisma.sql`a."postalCode"`;
    }

    if (sortBy === 'isDefault') {
      return Prisma.sql`a."isDefault"`;
    }

    if (sortBy === 'userEmail') {
      return Prisma.sql`u."email"`;
    }

    return Prisma.sql`a."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
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

    if (typeof value === 'object') {
      const primitiveValue = value.valueOf();

      return primitiveValue === value ? Number.NaN : Number(primitiveValue);
    }

    return Number(value);
  }

  private formatDate(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }
}
