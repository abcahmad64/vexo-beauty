import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

type CategoryTreeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  depth: number;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  children: CategoryTreeNode[];
};

@Injectable()
export class AdminCategoryTreeService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(includeInactive = false) {
    const where: Prisma.Sql[] = [Prisma.sql`c."deleted_at" IS NULL`];

    if (!includeInactive) {
      where.push(Prisma.sql`c."isActive" = TRUE`);
    }

    const rows = await this.prisma.$queryRaw<CategoryTreeRow[]>(
      Prisma.sql`
          SELECT
            c."id",
            c."name",
            c."slug",
            c."description",
            c."parent_id" AS "parentId",
            c."image",
            c."isActive",
            c."sortOrder",
            (
              SELECT
                COUNT(*)::int
              FROM "Product" p
              WHERE
                p."categoryId" = c."id"
                AND p."deleted_at" IS NULL
            ) AS "productCount",
            c."createdAt",
            c."updatedAt"
          FROM "Category" c
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            c."sortOrder" ASC,
            c."name" ASC
        `,
    );

    return {
      data: this.buildTree(rows),
      meta: {
        total: rows.length,
        includeInactive,
      },
    };
  }

  private buildTree(rows: CategoryTreeRow[]): CategoryTreeNode[] {
    const nodeMap = new Map<string, CategoryTreeNode>();

    const roots: CategoryTreeNode[] = [];

    for (const row of rows) {
      nodeMap.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentId: row.parentId,
        image: row.image,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        productCount: this.toNumber(row.productCount),
        depth: 0,
        createdAt: row.createdAt.toISOString(),
        createdAtFa: this.formatDateTimeFa(row.createdAt),
        updatedAt: row.updatedAt.toISOString(),
        updatedAtFa: this.formatDateTimeFa(row.updatedAt),
        children: [],
      });
    }

    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId);

        if (parent) {
          parent.children.push(node);
        }

        continue;
      }

      roots.push(node);
    }

    for (const root of roots) {
      this.assignDepth(root, 0);

      this.sortChildren(root);
    }

    return roots.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'),
    );
  }

  private assignDepth(node: CategoryTreeNode, depth: number): void {
    node.depth = depth;

    for (const child of node.children) {
      this.assignDepth(child, depth + 1);
    }
  }

  private sortChildren(node: CategoryTreeNode): void {
    node.children.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'),
    );

    for (const child of node.children) {
      this.sortChildren(child);
    }
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
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
}
