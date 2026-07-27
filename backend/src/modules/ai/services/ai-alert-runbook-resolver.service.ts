import { Injectable } from '@nestjs/common';

import {
  AI_ALERT_RUNBOOK_VERSION,
  type AiAlertRunbookRecord,
  type AiAlertRunbookResolveInput,
  type AiAlertSeverity,
} from '../interfaces/ai-alert-runbook.interface';
import { AiAlertRunbookService } from './ai-alert-runbook.service';
import { AiAlertRunbookUtil } from './ai-alert-runbook.util';

@Injectable()
export class AiAlertRunbookResolverService {
  constructor(private readonly runbookService: AiAlertRunbookService) {}

  async resolve(input: AiAlertRunbookResolveInput) {
    const asOf = input.asOf ? new Date(input.asOf) : new Date();
    if (Number.isNaN(asOf.getTime()))
      throw new Error('Invalid asOf timestamp.');
    const policies = await this.runbookService.findRunbooks({
      source: input.source,
      isActive: true,
      includeDeleted: false,
    });
    const matches = policies
      .map((runbook) => ({
        runbook,
        score: AiAlertRunbookUtil.matchScore(runbook, input),
      }))
      .filter(
        (item): item is { runbook: AiAlertRunbookRecord; score: number } =>
          item.score !== null &&
          AiAlertRunbookUtil.isEffective(item.runbook, asOf),
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.runbook.priority - right.runbook.priority ||
          left.runbook.createdAt.localeCompare(right.runbook.createdAt),
      )
      .map(({ runbook, score }) => ({
        id: runbook.id,
        name: runbook.name,
        title: runbook.title,
        url: runbook.url,
        owner: runbook.owner,
        summary: runbook.summary,
        priority: runbook.priority,
        score,
        source: runbook.source,
        decision: runbook.decision,
        severity: runbook.severity,
        scope: runbook.scope,
        scopeValue: runbook.scopeValue,
        policyVersion: runbook.policyVersion,
      }));

    return {
      version: AI_ALERT_RUNBOOK_VERSION,
      readOnly: true,
      asOf: asOf.toISOString(),
      input,
      matchedCount: matches.length,
      runbooks: matches,
      semantics: {
        storage: 'AiGuardrailRule_VERSIONED_JSON',
        mode: 'OBSERVABILITY_AND_GUIDANCE_ONLY',
        automaticExecution: false,
        automaticNotification: false,
      },
    };
  }

  severityForSloDecision(decision: string): AiAlertSeverity {
    if (decision === 'BREACHED') return 'CRITICAL';
    if (decision === 'WARN') return 'WARNING';
    return 'INFO';
  }
}
