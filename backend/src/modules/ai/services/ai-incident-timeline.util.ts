import {
  AI_INCIDENT_TIMELINE_VERSION,
  type AiIncidentEventType,
  type AiIncidentStatus,
  type AiIncidentTimelineDocument,
  type AiIncidentTimelineEventRecord,
} from '../interfaces/ai-incident-timeline.interface';

export class AiIncidentTimelineUtil {
  static nextStatus(
    current: AiIncidentStatus | null,
    event: AiIncidentEventType,
  ): AiIncidentStatus {
    if (!current) {
      if (event !== 'OPENED')
        throw new Error('First incident event must be OPENED.');
      return 'OPEN';
    }
    const allowed: Record<AiIncidentStatus, readonly AiIncidentEventType[]> = {
      OPEN: [
        'SEVERITY_CHANGED',
        'EVIDENCE_ATTACHED',
        'RUNBOOK_LINKED',
        'ACKNOWLEDGED',
        'MITIGATION_STARTED',
        'NOTE_ADDED',
      ],
      ACKNOWLEDGED: [
        'SEVERITY_CHANGED',
        'EVIDENCE_ATTACHED',
        'RUNBOOK_LINKED',
        'MITIGATION_STARTED',
        'MITIGATED',
        'NOTE_ADDED',
      ],
      MITIGATING: [
        'SEVERITY_CHANGED',
        'EVIDENCE_ATTACHED',
        'RUNBOOK_LINKED',
        'MITIGATED',
        'RESOLVED',
        'NOTE_ADDED',
      ],
      MITIGATED: [
        'SEVERITY_CHANGED',
        'EVIDENCE_ATTACHED',
        'RUNBOOK_LINKED',
        'RESOLVED',
        'REOPENED',
        'NOTE_ADDED',
      ],
      RESOLVED: ['REOPENED', 'NOTE_ADDED'],
    };
    if (!allowed[current].includes(event))
      throw new Error(`Event ${event} is not allowed from status ${current}.`);
    if (event === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
    if (event === 'MITIGATION_STARTED') return 'MITIGATING';
    if (event === 'MITIGATED') return 'MITIGATED';
    if (event === 'RESOLVED') return 'RESOLVED';
    if (event === 'REOPENED') return 'OPEN';
    return current;
  }

  static document(
    input: Omit<
      AiIncidentTimelineDocument,
      'version' | 'correlation' | 'runbookIds'
    > & {
      requestId?: string | null;
      traceId?: string | null;
      runId?: string | null;
      jobId?: string | null;
      runbookIds?: readonly string[];
    },
  ): AiIncidentTimelineDocument {
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
      throw new Error('Invalid sequence.');
    const date = new Date(input.occurredAt);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid occurredAt.');
    return {
      version: AI_INCIDENT_TIMELINE_VERSION,
      incidentId: input.incidentId,
      sequence: input.sequence,
      eventType: input.eventType,
      severity: input.severity,
      status: input.status,
      source: input.source.trim(),
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      actorId: input.actorId,
      occurredAt: date.toISOString(),
      correlation: {
        requestId: input.requestId?.trim() || null,
        traceId: input.traceId?.trim() || null,
        runId: input.runId?.trim() || null,
        jobId: input.jobId?.trim() || null,
      },
      runbookIds: [...new Set(input.runbookIds ?? [])],
      evidence: input.evidence,
      metadata: input.metadata,
    };
  }

  static snapshot(events: readonly AiIncidentTimelineEventRecord[]) {
    if (!events.length) throw new Error('Incident timeline is empty.');
    const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
    ordered.forEach((event, index) => {
      if (event.sequence !== index + 1)
        throw new Error('Incident sequence has a gap.');
    });
    const first = ordered[0];
    const last = ordered.at(-1)!;
    return {
      incidentId: first.incidentId,
      eventCount: ordered.length,
      lastSequence: last.sequence,
      currentSeverity: last.severity,
      currentStatus: last.status,
      openedAt: first.occurredAt,
      updatedAt: last.occurredAt,
      timeline: ordered,
    };
  }
}
