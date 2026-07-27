import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../core/prisma/prisma.service';
import type {
  AdminAppendAiIncidentEventDto,
  AdminOpenAiIncidentDto,
  QueryAiIncidentTimelinesDto,
} from '../dto/admin-ai-incident-timeline.dto';
import {
  AI_INCIDENT_TIMELINE_CATEGORY,
  type AiIncidentSeverity,
  type AiIncidentTimelineDocument,
  type AiIncidentTimelineEventRecord,
} from '../interfaces/ai-incident-timeline.interface';
import { AiIncidentRedactionUtil } from './ai-incident-redaction.util';
import { AiIncidentTimelineUtil } from './ai-incident-timeline.util';

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  timestamp: Date;
  userId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: Date;
};

@Injectable()
export class AiIncidentTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async openIncident(dto: AdminOpenAiIncidentDto, actorId: string) {
    const incidentId = dto.incidentId ?? randomUUID();
    if ((await this.rows(incidentId)).length)
      throw new ConflictException('Incident قبلاً ایجاد شده است.');
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, incidentId);
      await this.insert(tx, {
        incidentId,
        sequence: 1,
        eventType: 'OPENED',
        severity: dto.severity,
        status: 'OPEN',
        source: dto.source,
        title: dto.title,
        summary: dto.summary ?? null,
        actorId,
        occurredAt: dto.occurredAt ?? new Date().toISOString(),
        requestId: dto.requestId,
        traceId: dto.traceId,
        runId: dto.runId,
        jobId: dto.jobId,
        runbookIds: dto.runbookIds,
        evidence: dto.evidence ?? null,
        metadata: dto.metadata ?? null,
      });
    });
    return this.getIncident(incidentId);
  }

  async appendEvent(
    incidentId: string,
    dto: AdminAppendAiIncidentEventDto,
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, incidentId);
      const events = (await this.rows(incidentId, tx)).map((row) =>
        this.parse(row),
      );
      if (!events.length) throw new NotFoundException('Incident یافت نشد.');
      const snapshot = AiIncidentTimelineUtil.snapshot(events);
      const status = this.transition(snapshot.currentStatus, dto.eventType);
      const severity =
        dto.severity ??
        (dto.eventType === 'SEVERITY_CHANGED'
          ? this.requiredSeverity()
          : snapshot.currentSeverity);
      return this.insert(tx, {
        incidentId,
        sequence: snapshot.lastSequence + 1,
        eventType: dto.eventType,
        severity,
        status,
        source: events[0].source,
        title: dto.title ?? dto.eventType.replaceAll('_', ' '),
        summary: dto.summary ?? null,
        actorId,
        occurredAt: dto.occurredAt ?? new Date().toISOString(),
        requestId: dto.requestId,
        traceId: dto.traceId,
        runId: dto.runId,
        jobId: dto.jobId,
        runbookIds: dto.runbookIds,
        evidence: dto.evidence ?? null,
        metadata: dto.metadata ?? null,
      });
    });
  }

  async getIncident(incidentId: string) {
    const events = (await this.rows(incidentId)).map((row) => this.parse(row));
    if (!events.length) throw new NotFoundException('Incident یافت نشد.');
    return AiIncidentTimelineUtil.snapshot(events);
  }

  async listIncidents(query: QueryAiIncidentTimelinesDto = {}) {
    const rows = await this.prisma.event.findMany({
      where: { category: AI_INCIDENT_TIMELINE_CATEGORY, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        timestamp: true,
        userId: true,
        data: true,
        createdAt: true,
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(query.limit ?? 50, 200) * 20,
    });
    const groups = new Map<string, AiIncidentTimelineEventRecord[]>();
    rows.forEach((row) => {
      const event = this.parse(row);
      groups.set(event.incidentId, [
        ...(groups.get(event.incidentId) ?? []),
        event,
      ]);
    });
    return [...groups.values()]
      .map((events) => AiIncidentTimelineUtil.snapshot(events))
      .filter((x) => !query.source || x.timeline[0].source === query.source)
      .filter((x) => !query.severity || x.currentSeverity === query.severity)
      .filter((x) => !query.status || x.currentStatus === query.status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, query.limit ?? 50);
  }

  private async lock(tx: Prisma.TransactionClient, incidentId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-incident:${incidentId}`}, 0))`,
    );
  }

  private async rows(
    incidentId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<EventRow[]> {
    return client.event.findMany({
      where: {
        category: AI_INCIDENT_TIMELINE_CATEGORY,
        deletedAt: null,
        data: { path: ['incidentId'], equals: incidentId },
      },
      select: {
        id: true,
        name: true,
        description: true,
        timestamp: true,
        userId: true,
        data: true,
        createdAt: true,
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  private async insert(
    tx: Prisma.TransactionClient,
    input: Parameters<typeof AiIncidentTimelineUtil.document>[0],
  ) {
    const document = AiIncidentTimelineUtil.document({
      ...input,
      summary: AiIncidentRedactionUtil.text(input.summary),
      evidence: AiIncidentRedactionUtil.object(input.evidence),
      metadata: AiIncidentRedactionUtil.object(input.metadata),
    });
    return this.parse(
      await tx.event.create({
        data: {
          name: document.eventType,
          description: document.summary,
          category: AI_INCIDENT_TIMELINE_CATEGORY,
          timestamp: new Date(document.occurredAt),
          userId: document.actorId,
          data: document as unknown as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          name: true,
          description: true,
          timestamp: true,
          userId: true,
          data: true,
          createdAt: true,
        },
      }),
    );
  }

  private parse(row: EventRow): AiIncidentTimelineEventRecord {
    const data = row.data as unknown as AiIncidentTimelineDocument;
    if (!data || data.version !== '1.0.0')
      throw new BadRequestException(`Incident event ${row.id} نامعتبر است.`);
    return { eventId: row.id, ...data, createdAt: row.createdAt.toISOString() };
  }

  private transition(
    current: Parameters<typeof AiIncidentTimelineUtil.nextStatus>[0],
    event: Parameters<typeof AiIncidentTimelineUtil.nextStatus>[1],
  ) {
    try {
      return AiIncidentTimelineUtil.nextStatus(current, event);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Transition نامعتبر است.',
      );
    }
  }

  private requiredSeverity(): AiIncidentSeverity {
    throw new BadRequestException(
      'برای SEVERITY_CHANGED مقدار severity الزامی است.',
    );
  }
}
