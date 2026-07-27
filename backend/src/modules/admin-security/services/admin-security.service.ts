import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AdminCreateIpRuleDto,
  AdminUpdateIpRuleDto,
} from '../dto/admin-ip-rule.dto';

import { AdminQuerySecurityDto } from '../dto/admin-query-security.dto';

import { AdminSecurityEvaluateDto } from '../dto/admin-security-evaluate.dto';

import { AdminSecurityExportQueryDto } from '../dto/admin-security-export-query.dto';

import {
  AdminAssignSecurityIncidentDto,
  AdminCreateSecurityIncidentDto,
  AdminUpdateSecurityIncidentDto,
  AdminUpdateSecurityIncidentStatusDto,
} from '../dto/admin-security-incident.dto';

import { AdminSecurityNoteDto } from '../dto/admin-security-note.dto';

import {
  AdminCreateSecurityPolicyDto,
  AdminUpdateSecurityPolicyDto,
} from '../dto/admin-security-policy.dto';

type CountRow = {
  count: number | bigint;
};

type AdminSecurityIncidentRow = {
  id: string;
  incidentNumber: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  assignedAdminId: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  metadata: unknown;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AdminSecurityPolicyRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  configJson: unknown;
  isEnabled: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AdminIpRuleRow = {
  id: string;
  ipAddress: string;
  cidr: string | null;
  type: string;
  reason: string;
  expiresAt: Date | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AdminSecurityEvaluationRow = {
  id: string;
  userId: string | null;
  ipAddress: string | null;
  route: string;
  method: string;
  userAgent: string | null;
  decision: string;
  riskScore: number;
  matchedRuleIds: unknown;
  reasonsJson: unknown;
  metadata: unknown;
  createdAt: Date;
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

type SecurityEvaluationResult = {
  decision: 'ALLOW' | 'WATCH' | 'BLOCK';
  riskScore: number;
  matchedRuleIds: string[];
  reasons: string[];
};

@Injectable()
export class AdminSecurityService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [incidentRows, ipRows, policyRows, evaluationRows] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            status: string;
            severity: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              "status",
              "severity",
              COUNT(*)::int AS "count"
            FROM "AdminSecurityIncident"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '30 days'
            GROUP BY
              "status",
              "severity"
            ORDER BY
              "severity" DESC,
              "status" ASC
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            type: string;
            count: number | bigint;
          }>
        >(
          Prisma.sql`
            SELECT
              "type",
              COUNT(*)::int AS "count"
            FROM "AdminIpRule"
            WHERE
              "deleted_at" IS NULL
              AND "isActive" = TRUE
              AND (
                "expiresAt" IS NULL
                OR "expiresAt" >= NOW()
              )
            GROUP BY "type"
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminSecurityPolicy"
            WHERE
              "deleted_at" IS NULL
              AND "isEnabled" = TRUE
          `,
        ),
        this.prisma.$queryRaw<
          Array<{
            decision: string;
            count: number | bigint;
            averageRiskScore: unknown;
          }>
        >(
          Prisma.sql`
            SELECT
              "decision",
              COUNT(*)::int AS "count",
              COALESCE(AVG("riskScore"), 0)::numeric AS "averageRiskScore"
            FROM "AdminSecurityEvaluationLog"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= NOW() - INTERVAL '24 hours'
            GROUP BY "decision"
          `,
        ),
      ]);

    return {
      incidentsLast30Days: incidentRows.map((row) => ({
        status: row.status,
        severity: row.severity,
        count: this.toNumber(row.count),
      })),
      activeIpRules: ipRows.map((row) => ({
        type: row.type,
        count: this.toNumber(row.count),
      })),
      enabledPolicies: this.toNumber(policyRows[0]?.count),
      evaluationsLast24Hours: evaluationRows.map((row) => ({
        decision: row.decision,
        count: this.toNumber(row.count),
        averageRiskScore: this.toDecimalString(row.averageRiskScore),
      })),
    };
  }

  async findIncidents(query: AdminQuerySecurityDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildIncidentWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminSecurityIncidentRow[]>(
        Prisma.sql`
            ${this.incidentSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              i."createdAt" DESC,
              i."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminSecurityIncident" i
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapIncident(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createIncident(dto: AdminCreateSecurityIncidentDto, actorId?: string) {
    const incidentId = randomUUID();

    const incidentNumber = await this.generateIncidentNumber();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminSecurityIncident" (
          "id",
          "incidentNumber",
          "title",
          "description",
          "severity",
          "status",
          "source",
          "targetType",
          "targetId",
          "ipAddress",
          "userAgent",
          "assignedAdminId",
          "metadata",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${incidentId},
          ${incidentNumber},
          ${dto.title},
          ${dto.description ?? null},
          ${dto.severity ?? 'MEDIUM'},
          'OPEN',
          ${dto.source ?? 'SYSTEM'},
          ${dto.targetType ?? 'SYSTEM'},
          ${dto.targetId ?? null},
          ${dto.ipAddress ?? null},
          ${dto.userAgent ?? null},
          ${dto.assignedAdminId ?? null},
          ${JSON.stringify(dto.metadata ?? {})}::jsonb,
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'admin_security.incident.created',
      'رخداد امنیتی توسط ادمین ایجاد شد.',
      incidentId,
      actorId,
      {
        incidentId,
        incidentNumber,
        severity: dto.severity ?? 'MEDIUM',
      },
    );

    return {
      incident: await this.findIncident(incidentId, true),
    };
  }

  async findIncident(incidentId: string, includeDeleted = true) {
    const incident = await this.findIncidentRow(incidentId, includeDeleted);

    const notes = await this.findNotes(
      'admin_security.incident.note.created',
      'incidentId',
      incidentId,
      50,
    );

    return {
      ...this.mapIncident(incident),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async updateIncident(
    incidentId: string,
    dto: AdminUpdateSecurityIncidentDto,
    actorId?: string,
  ) {
    await this.findIncidentRow(incidentId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.severity !== undefined) {
      assignments.push(Prisma.sql`"severity" = ${dto.severity}`);
    }

    if (dto.source !== undefined) {
      assignments.push(Prisma.sql`"source" = ${dto.source}`);
    }

    if (dto.targetType !== undefined) {
      assignments.push(Prisma.sql`"targetType" = ${dto.targetType}`);
    }

    if (dto.targetId !== undefined) {
      assignments.push(Prisma.sql`"targetId" = ${dto.targetId}`);
    }

    if (dto.ipAddress !== undefined) {
      assignments.push(Prisma.sql`"ipAddress" = ${dto.ipAddress}`);
    }

    if (dto.userAgent !== undefined) {
      assignments.push(Prisma.sql`"userAgent" = ${dto.userAgent}`);
    }

    if (dto.metadata !== undefined) {
      assignments.push(
        Prisma.sql`"metadata" = ${JSON.stringify(dto.metadata)}::jsonb`,
      );
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی رخداد امنیتی ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminSecurityIncident"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${incidentId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'admin_security.incident.updated',
      'رخداد امنیتی توسط ادمین به‌روزرسانی شد.',
      incidentId,
      actorId,
      {
        incidentId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      incident: await this.findIncident(incidentId, true),
    };
  }

  async updateIncidentStatus(
    incidentId: string,
    dto: AdminUpdateSecurityIncidentStatusDto,
    actorId?: string,
  ) {
    const current = await this.findIncidentRow(incidentId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminSecurityIncident"
        SET
          "status" = ${dto.status},
          "resolvedById" = CASE
            WHEN ${dto.status} IN ('RESOLVED', 'DISMISSED') THEN ${actorId ?? null}
            ELSE "resolvedById"
          END,
          "resolvedAt" = CASE
            WHEN ${dto.status} IN ('RESOLVED', 'DISMISSED') THEN NOW()
            ELSE "resolvedAt"
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${incidentId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'admin_security.incident.status.updated',
      'وضعیت رخداد امنیتی توسط ادمین تغییر کرد.',
      incidentId,
      actorId,
      {
        incidentId,
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      incident: await this.findIncident(incidentId, true),
    };
  }

  async assignIncident(
    incidentId: string,
    dto: AdminAssignSecurityIncidentDto,
    actorId?: string,
  ) {
    await this.findIncidentRow(incidentId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminSecurityIncident"
        SET
          "assignedAdminId" = ${dto.adminId ?? actorId ?? null},
          "status" = CASE
            WHEN "status" = 'OPEN' THEN 'INVESTIGATING'
            ELSE "status"
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${incidentId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'admin_security.incident.assigned',
      'رخداد امنیتی به ادمین اختصاص داده شد.',
      incidentId,
      actorId,
      {
        incidentId,
        assignedAdminId: dto.adminId ?? actorId ?? null,
        reason: dto.reason ?? null,
      },
    );

    return {
      incident: await this.findIncident(incidentId, true),
    };
  }

  async deleteIncident(incidentId: string, actorId?: string) {
    await this.findIncidentRow(incidentId, false);

    await this.softDelete('AdminSecurityIncident', incidentId);

    await this.createSystemEvent(
      'admin_security.incident.deleted',
      'رخداد امنیتی توسط ادمین حذف نرم شد.',
      incidentId,
      actorId,
      {
        incidentId,
      },
    );

    return {
      success: true,
      message: 'رخداد امنیتی با موفقیت حذف شد.',
    };
  }

  async restoreIncident(incidentId: string, actorId?: string) {
    await this.findIncidentRow(incidentId, true);

    await this.restore('AdminSecurityIncident', incidentId);

    await this.createSystemEvent(
      'admin_security.incident.restored',
      'رخداد امنیتی حذف‌شده توسط ادمین بازگردانی شد.',
      incidentId,
      actorId,
      {
        incidentId,
      },
    );

    return {
      incident: await this.findIncident(incidentId, true),
    };
  }

  async findPolicies(query: AdminQuerySecurityDto) {
    const where = this.buildPolicyWhere(query);

    const rows = await this.prisma.$queryRaw<AdminSecurityPolicyRow[]>(
      Prisma.sql`
          ${this.policySelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            p."category" ASC,
            p."key" ASC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapPolicy(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createPolicy(dto: AdminCreateSecurityPolicyDto, actorId?: string) {
    const key = this.normalizeKey(dto.key);

    await this.assertPolicyKeyUnique(key);

    const policyId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminSecurityPolicy" (
          "id",
          "key",
          "title",
          "description",
          "category",
          "severity",
          "configJson",
          "isEnabled",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${policyId},
          ${key},
          ${dto.title},
          ${dto.description ?? null},
          ${dto.category ?? 'SYSTEM'},
          ${dto.severity ?? 'MEDIUM'},
          ${JSON.stringify(dto.config ?? {})}::jsonb,
          ${dto.isEnabled ?? true},
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'admin_security.policy.created',
      'سیاست امنیتی توسط ادمین ایجاد شد.',
      policyId,
      actorId,
      {
        policyId,
        key,
      },
    );

    return {
      policy: await this.findPolicy(policyId, true),
    };
  }

  async findPolicy(policyId: string, includeDeleted = true) {
    const row = await this.findPolicyRow(policyId, includeDeleted);

    return this.mapPolicy(row);
  }

  async updatePolicy(
    policyId: string,
    dto: AdminUpdateSecurityPolicyDto,
    actorId?: string,
  ) {
    const current = await this.findPolicyRow(policyId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.key !== undefined) {
      const key = this.normalizeKey(dto.key);

      if (key !== current.key) {
        await this.assertPolicyKeyUnique(key, policyId);
      }

      assignments.push(Prisma.sql`"key" = ${key}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.category !== undefined) {
      assignments.push(Prisma.sql`"category" = ${dto.category}`);
    }

    if (dto.severity !== undefined) {
      assignments.push(Prisma.sql`"severity" = ${dto.severity}`);
    }

    if (dto.config !== undefined) {
      assignments.push(
        Prisma.sql`"configJson" = ${JSON.stringify(dto.config)}::jsonb`,
      );
    }

    if (dto.isEnabled !== undefined) {
      assignments.push(Prisma.sql`"isEnabled" = ${dto.isEnabled}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سیاست امنیتی ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminSecurityPolicy"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${policyId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'admin_security.policy.updated',
      'سیاست امنیتی توسط ادمین به‌روزرسانی شد.',
      policyId,
      actorId,
      {
        policyId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      policy: await this.findPolicy(policyId, true),
    };
  }

  async deletePolicy(policyId: string, actorId?: string) {
    await this.findPolicyRow(policyId, false);

    await this.softDelete('AdminSecurityPolicy', policyId);

    await this.createSystemEvent(
      'admin_security.policy.deleted',
      'سیاست امنیتی توسط ادمین حذف نرم شد.',
      policyId,
      actorId,
      {
        policyId,
      },
    );

    return {
      success: true,
      message: 'سیاست امنیتی با موفقیت حذف شد.',
    };
  }

  async restorePolicy(policyId: string, actorId?: string) {
    await this.findPolicyRow(policyId, true);

    await this.restore('AdminSecurityPolicy', policyId);

    await this.createSystemEvent(
      'admin_security.policy.restored',
      'سیاست امنیتی حذف‌شده توسط ادمین بازگردانی شد.',
      policyId,
      actorId,
      {
        policyId,
      },
    );

    return {
      policy: await this.findPolicy(policyId, true),
    };
  }

  async findIpRules(query: AdminQuerySecurityDto) {
    const where = this.buildIpRuleWhere(query);

    const rows = await this.prisma.$queryRaw<AdminIpRuleRow[]>(
      Prisma.sql`
          ${this.ipRuleSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            r."type" ASC,
            r."createdAt" DESC
          LIMIT 500
        `,
    );

    return {
      data: rows.map((row) => this.mapIpRule(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async createIpRule(dto: AdminCreateIpRuleDto, actorId?: string) {
    const ruleId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminIpRule" (
          "id",
          "ipAddress",
          "cidr",
          "type",
          "reason",
          "expiresAt",
          "isActive",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${ruleId},
          ${dto.ipAddress},
          ${dto.cidr ?? null},
          ${dto.type},
          ${dto.reason},
          ${dto.expiresAt ? new Date(dto.expiresAt) : null},
          ${dto.isActive ?? true},
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'admin_security.ip_rule.created',
      'قانون IP امنیتی توسط ادمین ایجاد شد.',
      ruleId,
      actorId,
      {
        ruleId,
        ipAddress: dto.ipAddress,
        type: dto.type,
      },
    );

    return {
      ipRule: await this.findIpRule(ruleId, true),
    };
  }

  async findIpRule(ruleId: string, includeDeleted = true) {
    const row = await this.findIpRuleRow(ruleId, includeDeleted);

    return this.mapIpRule(row);
  }

  async updateIpRule(
    ruleId: string,
    dto: AdminUpdateIpRuleDto,
    actorId?: string,
  ) {
    await this.findIpRuleRow(ruleId, false);

    const assignments: Prisma.Sql[] = [];

    if (dto.ipAddress !== undefined) {
      assignments.push(Prisma.sql`"ipAddress" = ${dto.ipAddress}`);
    }

    if (dto.cidr !== undefined) {
      assignments.push(Prisma.sql`"cidr" = ${dto.cidr}`);
    }

    if (dto.type !== undefined) {
      assignments.push(Prisma.sql`"type" = ${dto.type}`);
    }

    if (dto.reason !== undefined) {
      assignments.push(Prisma.sql`"reason" = ${dto.reason}`);
    }

    if (dto.clearExpiresAt === true) {
      assignments.push(Prisma.sql`"expiresAt" = NULL`);
    } else if (dto.expiresAt !== undefined) {
      assignments.push(Prisma.sql`"expiresAt" = ${new Date(dto.expiresAt)}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قانون IP ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminIpRule"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${ruleId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'admin_security.ip_rule.updated',
      'قانون IP امنیتی توسط ادمین به‌روزرسانی شد.',
      ruleId,
      actorId,
      {
        ruleId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      ipRule: await this.findIpRule(ruleId, true),
    };
  }

  async deleteIpRule(ruleId: string, actorId?: string) {
    await this.findIpRuleRow(ruleId, false);

    await this.softDelete('AdminIpRule', ruleId);

    await this.createSystemEvent(
      'admin_security.ip_rule.deleted',
      'قانون IP امنیتی توسط ادمین حذف نرم شد.',
      ruleId,
      actorId,
      {
        ruleId,
      },
    );

    return {
      success: true,
      message: 'قانون IP با موفقیت حذف شد.',
    };
  }

  async restoreIpRule(ruleId: string, actorId?: string) {
    await this.findIpRuleRow(ruleId, true);

    await this.restore('AdminIpRule', ruleId);

    await this.createSystemEvent(
      'admin_security.ip_rule.restored',
      'قانون IP امنیتی حذف‌شده توسط ادمین بازگردانی شد.',
      ruleId,
      actorId,
      {
        ruleId,
      },
    );

    return {
      ipRule: await this.findIpRule(ruleId, true),
    };
  }

  async evaluateRequest(dto: AdminSecurityEvaluateDto, actorId?: string) {
    const result = await this.evaluate(dto);

    const evaluationId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminSecurityEvaluationLog" (
          "id",
          "userId",
          "ipAddress",
          "route",
          "method",
          "userAgent",
          "decision",
          "riskScore",
          "matchedRuleIds",
          "reasonsJson",
          "metadata",
          "createdAt"
        )
        VALUES (
          ${evaluationId},
          ${dto.userId ?? null},
          ${dto.ipAddress ?? null},
          ${dto.route},
          ${dto.method.toUpperCase()},
          ${dto.userAgent ?? null},
          ${result.decision},
          ${result.riskScore},
          ${JSON.stringify(result.matchedRuleIds)}::jsonb,
          ${JSON.stringify(result.reasons)}::jsonb,
          ${JSON.stringify(dto.metadata ?? {})}::jsonb,
          NOW()
        )
      `,
    );

    if (dto.createIncident === true && result.decision !== 'ALLOW') {
      await this.createIncident(
        {
          title:
            result.decision === 'BLOCK'
              ? 'درخواست مشکوک مسدود شد'
              : 'درخواست نیازمند پایش امنیتی',
          description: result.reasons.join(' | '),
          severity: result.decision === 'BLOCK' ? 'HIGH' : 'MEDIUM',
          source: 'API',
          targetType: dto.userId ? 'USER' : 'IP',
          targetId: dto.userId,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          metadata: {
            evaluationId,
            route: dto.route,
            method: dto.method.toUpperCase(),
            riskScore: result.riskScore,
          },
        },
        actorId,
      );
    }

    await this.createSystemEvent(
      'admin_security.request.evaluated',
      'درخواست توسط مرکز امنیت مدیریت ارزیابی شد.',
      evaluationId,
      actorId,
      {
        evaluationId,
        decision: result.decision,
        riskScore: result.riskScore,
      },
    );

    return {
      evaluationId,
      ...result,
    };
  }

  async findEvaluations(query: AdminQuerySecurityDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildEvaluationWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminSecurityEvaluationRow[]>(
        Prisma.sql`
            ${this.evaluationSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              e."createdAt" DESC,
              e."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminSecurityEvaluationLog" e
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapEvaluation(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createIncidentNote(
    incidentId: string,
    dto: AdminSecurityNoteDto,
    actorId?: string,
  ) {
    await this.findIncidentRow(incidentId, true);

    const noteId = await this.createSystemEvent(
      'admin_security.incident.note.created',
      'یادداشت مدیریتی برای رخداد امنیتی ثبت شد.',
      incidentId,
      actorId,
      {
        incidentId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت امنیتی با موفقیت ثبت شد.',
    };
  }

  async getIncidentNotes(incidentId: string, limit = 50) {
    await this.findIncidentRow(incidentId, true);

    const notes = await this.findNotes(
      'admin_security.incident.note.created',
      'incidentId',
      incidentId,
      limit,
    );

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        incidentId,
        total: notes.length,
      },
    };
  }

  async findForExport(
    query: AdminSecurityExportQueryDto,
  ): Promise<Array<Record<string, unknown>>> {
    const entity = query.entity ?? 'incidents';

    if (entity === 'policies') {
      return (
        await this.findPolicies({
          q: query.q,
          severity: this.normalizeSeverityFilter(query.severity),
        })
      ).data;
    }

    if (entity === 'ip-rules') {
      return (
        await this.findIpRules({
          q: query.q,
          ipAddress: query.ipAddress,
        })
      ).data;
    }

    if (entity === 'evaluations') {
      return (
        await this.findEvaluations({
          page: 1,
          limit: 200,
          q: query.q,
          ipAddress: query.ipAddress,
        })
      ).data;
    }

    return (
      await this.findIncidents({
        page: 1,
        limit: 200,
        q: query.q,
        status: this.normalizeStatusFilter(query.status),
        severity: this.normalizeSeverityFilter(query.severity),
        ipAddress: query.ipAddress,
      })
    ).data;
  }

  private async evaluate(
    dto: AdminSecurityEvaluateDto,
  ): Promise<SecurityEvaluationResult> {
    const reasons: string[] = [];
    const matchedRuleIds: string[] = [];
    let riskScore = 0;

    const ipRules = dto.ipAddress
      ? await this.findActiveRulesForIp(dto.ipAddress)
      : [];

    for (const rule of ipRules) {
      matchedRuleIds.push(rule.id);

      if (rule.type === 'ALLOW') {
        reasons.push('IP در لیست مجاز امنیتی قرار دارد.');

        riskScore = Math.max(riskScore - 20, 0);
      }

      if (rule.type === 'WATCH') {
        reasons.push(`IP نیازمند پایش است: ${rule.reason}`);

        riskScore += 35;
      }

      if (rule.type === 'BLOCK') {
        reasons.push(`IP مسدود شده است: ${rule.reason}`);

        riskScore += 100;
      }
    }

    if (!dto.userId && dto.route.startsWith('/api/admin')) {
      riskScore += 45;

      reasons.push('درخواست مدیریتی بدون شناسه کاربر ارسال شده است.');
    }

    if (
      dto.method.toUpperCase() !== 'GET' &&
      dto.route.startsWith('/api/admin') &&
      !dto.userId
    ) {
      riskScore += 35;

      reasons.push('درخواست تغییردهنده مدیریتی بدون کاربر معتبر شناسایی شد.');
    }

    if (
      dto.userAgent &&
      /curl|wget|python-requests|sqlmap|nikto/i.test(dto.userAgent)
    ) {
      riskScore += 40;

      reasons.push('User-Agent درخواست مشکوک تشخیص داده شد.');
    }

    const recentRiskCount = dto.ipAddress
      ? await this.countRecentHighRiskEvaluations(dto.ipAddress)
      : 0;

    if (recentRiskCount >= 5) {
      riskScore += 30;

      reasons.push('تعداد ارزیابی‌های پرریسک اخیر برای این IP زیاد است.');
    }

    if (riskScore >= 90) {
      return {
        decision: 'BLOCK',
        riskScore,
        matchedRuleIds,
        reasons,
      };
    }

    if (riskScore >= 40) {
      return {
        decision: 'WATCH',
        riskScore,
        matchedRuleIds,
        reasons,
      };
    }

    return {
      decision: 'ALLOW',
      riskScore,
      matchedRuleIds,
      reasons:
        reasons.length > 0
          ? reasons
          : ['ریسک قابل توجهی برای درخواست شناسایی نشد.'],
    };
  }

  private async findActiveRulesForIp(
    ipAddress: string,
  ): Promise<AdminIpRuleRow[]> {
    return this.prisma.$queryRaw<AdminIpRuleRow[]>(
      Prisma.sql`
        ${this.ipRuleSelectSql()}
        WHERE
          r."deleted_at" IS NULL
          AND r."isActive" = TRUE
          AND r."ipAddress" = ${ipAddress}
          AND (
            r."expiresAt" IS NULL
            OR r."expiresAt" >= NOW()
          )
        ORDER BY
          CASE r."type"
            WHEN 'BLOCK' THEN 1
            WHEN 'WATCH' THEN 2
            WHEN 'ALLOW' THEN 3
            ELSE 4
          END ASC
      `,
    );
  }

  private async countRecentHighRiskEvaluations(
    ipAddress: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "AdminSecurityEvaluationLog"
          WHERE
            "deleted_at" IS NULL
            AND "ipAddress" = ${ipAddress}
            AND "riskScore" >= 40
            AND "createdAt" >= NOW() - INTERVAL '1 hour'
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private incidentSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        i."id",
        i."incidentNumber",
        i."title",
        i."description",
        i."severity",
        i."status",
        i."source",
        i."targetType",
        i."targetId",
        i."ipAddress",
        i."userAgent",
        i."assignedAdminId",
        i."resolvedById",
        i."resolvedAt",
        i."metadata",
        i."createdById",
        i."createdAt",
        i."updatedAt",
        i."deleted_at" AS "deletedAt"
      FROM "AdminSecurityIncident" i
    `;
  }

  private policySelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        p."id",
        p."key",
        p."title",
        p."description",
        p."category",
        p."severity",
        p."configJson",
        p."isEnabled",
        p."createdById",
        p."createdAt",
        p."updatedAt",
        p."deleted_at" AS "deletedAt"
      FROM "AdminSecurityPolicy" p
    `;
  }

  private ipRuleSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        r."id",
        r."ipAddress",
        r."cidr",
        r."type",
        r."reason",
        r."expiresAt",
        r."isActive",
        r."createdById",
        r."createdAt",
        r."updatedAt",
        r."deleted_at" AS "deletedAt"
      FROM "AdminIpRule" r
    `;
  }

  private evaluationSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        e."id",
        e."userId",
        e."ipAddress",
        e."route",
        e."method",
        e."userAgent",
        e."decision",
        e."riskScore",
        e."matchedRuleIds",
        e."reasonsJson",
        e."metadata",
        e."createdAt",
        e."deleted_at" AS "deletedAt"
      FROM "AdminSecurityEvaluationLog" e
    `;
  }

  private buildIncidentWhere(query: AdminQuerySecurityDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          i."incidentNumber" ILIKE ${`%${query.q}%`}
          OR i."title" ILIKE ${`%${query.q}%`}
          OR i."description" ILIKE ${`%${query.q}%`}
          OR i."ipAddress" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.entityId) {
      where.push(Prisma.sql`i."id" = ${query.entityId}`);
    }

    if (query.severity) {
      where.push(Prisma.sql`i."severity" = ${query.severity}`);
    }

    if (query.status) {
      where.push(Prisma.sql`i."status" = ${query.status}`);
    }

    if (query.source) {
      where.push(Prisma.sql`i."source" = ${query.source}`);
    }

    if (query.targetType) {
      where.push(Prisma.sql`i."targetType" = ${query.targetType}`);
    }

    if (query.ipAddress) {
      where.push(Prisma.sql`i."ipAddress" = ${query.ipAddress}`);
    }

    if (query.assignedAdminId) {
      where.push(Prisma.sql`i."assignedAdminId" = ${query.assignedAdminId}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`i."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`i."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildPolicyWhere(query: AdminQuerySecurityDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          p."key" ILIKE ${`%${query.q}%`}
          OR p."title" ILIKE ${`%${query.q}%`}
          OR p."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.key) {
      where.push(
        Prisma.sql`p."key" ILIKE ${`%${this.normalizeKey(query.key)}%`}`,
      );
    }

    if (query.category) {
      where.push(Prisma.sql`p."category" = ${query.category}`);
    }

    if (query.severity) {
      where.push(Prisma.sql`p."severity" = ${query.severity}`);
    }

    if (query.isEnabled !== undefined) {
      where.push(Prisma.sql`p."isEnabled" = ${query.isEnabled}`);
    }

    return where;
  }

  private buildIpRuleWhere(query: AdminQuerySecurityDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          r."ipAddress" ILIKE ${`%${query.q}%`}
          OR r."cidr" ILIKE ${`%${query.q}%`}
          OR r."reason" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.ipAddress) {
      where.push(Prisma.sql`r."ipAddress" = ${query.ipAddress}`);
    }

    if (query.ipRuleType) {
      where.push(Prisma.sql`r."type" = ${query.ipRuleType}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`r."isActive" = ${query.isActive}`);
    }

    return where;
  }

  private buildEvaluationWhere(query: AdminQuerySecurityDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`e."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          e."route" ILIKE ${`%${query.q}%`}
          OR e."method" ILIKE ${`%${query.q}%`}
          OR e."userAgent" ILIKE ${`%${query.q}%`}
          OR e."ipAddress" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`e."userId" = ${query.userId}`);
    }

    if (query.ipAddress) {
      where.push(Prisma.sql`e."ipAddress" = ${query.ipAddress}`);
    }

    if (query.decision) {
      where.push(Prisma.sql`e."decision" = ${query.decision}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`e."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`e."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private async findIncidentRow(
    incidentId: string,
    includeDeleted: boolean,
  ): Promise<AdminSecurityIncidentRow> {
    const where: Prisma.Sql[] = [Prisma.sql`i."id" = ${incidentId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminSecurityIncidentRow[]>(
      Prisma.sql`
          ${this.incidentSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('رخداد امنیتی موردنظر یافت نشد.');
    }

    return row;
  }

  private async findPolicyRow(
    policyId: string,
    includeDeleted: boolean,
  ): Promise<AdminSecurityPolicyRow> {
    const where: Prisma.Sql[] = [Prisma.sql`p."id" = ${policyId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminSecurityPolicyRow[]>(
      Prisma.sql`
          ${this.policySelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('سیاست امنیتی موردنظر یافت نشد.');
    }

    return row;
  }

  private async findIpRuleRow(
    ruleId: string,
    includeDeleted: boolean,
  ): Promise<AdminIpRuleRow> {
    const where: Prisma.Sql[] = [Prisma.sql`r."id" = ${ruleId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminIpRuleRow[]>(
      Prisma.sql`
          ${this.ipRuleSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('قانون IP موردنظر یافت نشد.');
    }

    return row;
  }

  private async assertPolicyKeyUnique(
    key: string,
    exceptId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("key") = LOWER(${key})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptId) {
      where.push(Prisma.sql`"id" <> ${exceptId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "AdminSecurityPolicy"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کلید سیاست امنیتی تکراری است.');
    }
  }

  private async generateIncidentNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();

      const number = `SEC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)
        .toUpperCase()}`;

      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminSecurityIncident"
            WHERE LOWER("incidentNumber") = LOWER(${number})
          `,
      );

      if (this.toNumber(rows[0]?.count) === 0) {
        return number;
      }
    }

    throw new ConflictException(
      'امکان تولید شماره رخداد امنیتی یکتا وجود ندارد.',
    );
  }

  private async softDelete(tableName: string, id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${id}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async restore(tableName: string, id: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE ${Prisma.raw(`"${tableName}"`)}
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${id}
      `,
    );
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
          'admin-security',
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

  private mapIncident(row: AdminSecurityIncidentRow) {
    return {
      id: row.id,
      incidentNumber: row.incidentNumber,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      source: row.source,
      target: {
        type: row.targetType,
        id: row.targetId,
      },
      network: {
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
      },
      assignment: {
        assignedAdminId: row.assignedAdminId,
        resolvedById: row.resolvedById,
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      },
      metadata: row.metadata,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapPolicy(row: AdminSecurityPolicyRow) {
    return {
      id: row.id,
      key: row.key,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      config: row.configJson,
      isEnabled: row.isEnabled,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapIpRule(row: AdminIpRuleRow) {
    return {
      id: row.id,
      ipAddress: row.ipAddress,
      cidr: row.cidr,
      type: row.type,
      reason: row.reason,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      isActive: row.isActive,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapEvaluation(row: AdminSecurityEvaluationRow) {
    return {
      id: row.id,
      userId: row.userId,
      ipAddress: row.ipAddress,
      route: row.route,
      method: row.method,
      userAgent: row.userAgent,
      decision: row.decision,
      riskScore: row.riskScore,
      matchedRuleIds: this.toStringArray(row.matchedRuleIds),
      reasons: this.toStringArray(row.reasonsJson),
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
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

  private normalizeStatusFilter(
    value?: string,
  ): AdminQuerySecurityDto['status'] {
    if (
      value === 'OPEN' ||
      value === 'INVESTIGATING' ||
      value === 'RESOLVED' ||
      value === 'DISMISSED'
    ) {
      return value;
    }

    return undefined;
  }

  private normalizeSeverityFilter(
    value?: string,
  ): AdminQuerySecurityDto['severity'] {
    if (
      value === 'LOW' ||
      value === 'MEDIUM' ||
      value === 'HIGH' ||
      value === 'CRITICAL'
    ) {
      return value;
    }

    return undefined;
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
