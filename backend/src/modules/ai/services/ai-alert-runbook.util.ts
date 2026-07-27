import {
  AI_ALERT_DECISIONS,
  AI_ALERT_RUNBOOK_SCHEMA_VERSION,
  AI_ALERT_SEVERITIES,
  AI_ALERT_SOURCES,
  type AiAlertRunbookDocument,
  type AiAlertDecision,
  type AiAlertSeverity,
  type AiAlertSource,
} from '../interfaces/ai-alert-runbook.interface';

export interface AiAlertRunbookDatabaseRow {
  readonly id: string;
  readonly name: string;
  readonly pattern: string | null;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

interface CreateDocumentInput {
  readonly policyVersion: number;
  readonly source: AiAlertSource;
  readonly decision: AiAlertDecision;
  readonly severity: AiAlertSeverity;
  readonly scope?: string | null;
  readonly scopeValue?: string | null;
  readonly title: string;
  readonly url: string;
  readonly owner: string;
  readonly summary?: string | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly updatedById: string;
  readonly updatedAt?: string;
}

export class AiAlertRunbookUtil {
  static createDocument(input: CreateDocumentInput): AiAlertRunbookDocument {
    const source = this.assertMember(input.source, AI_ALERT_SOURCES, 'source');
    const decision = this.assertMember(
      input.decision,
      AI_ALERT_DECISIONS,
      'decision',
    );
    const severity = this.assertMember(
      input.severity,
      AI_ALERT_SEVERITIES,
      'severity',
    );
    const scope = this.optionalText(input.scope, 120);
    const scopeValue = this.optionalText(input.scopeValue, 240);
    if (scopeValue && !scope)
      throw new Error('scope is required when scopeValue is provided.');

    const title = this.requiredText(input.title, 'title', 180);
    const owner = this.requiredText(input.owner, 'owner', 180);
    const rawUrl = this.requiredText(input.url, 'url', 2048);
    const parsedUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('runbook url must use http or https.');
    }

    const effectiveFrom = this.optionalDate(input.effectiveFrom);
    const effectiveTo = this.optionalDate(input.effectiveTo);
    if (
      effectiveFrom &&
      effectiveTo &&
      new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()
    ) {
      throw new Error('effectiveTo must be after effectiveFrom.');
    }

    return {
      schemaVersion: AI_ALERT_RUNBOOK_SCHEMA_VERSION,
      policyVersion: this.positiveInteger(input.policyVersion, 'policyVersion'),
      source,
      decision,
      severity,
      scope,
      scopeValue,
      title,
      url: parsedUrl.toString(),
      owner,
      summary: this.optionalText(input.summary, 1200),
      effectiveFrom,
      effectiveTo,
      updatedById: this.requiredText(input.updatedById, 'updatedById', 240),
      updatedAt: this.requiredDate(input.updatedAt ?? new Date().toISOString()),
    };
  }

  static parseDocument(value: string | null): AiAlertRunbookDocument {
    if (!value) throw new Error('Alert runbook document is empty.');
    const parsed = JSON.parse(value) as Partial<AiAlertRunbookDocument>;
    if (parsed.schemaVersion !== AI_ALERT_RUNBOOK_SCHEMA_VERSION) {
      throw new Error('Unsupported alert runbook schema version.');
    }
    return this.createDocument({
      policyVersion: Number(parsed.policyVersion),
      source: parsed.source as AiAlertSource,
      decision: parsed.decision as AiAlertDecision,
      severity: parsed.severity as AiAlertSeverity,
      scope: parsed.scope,
      scopeValue: parsed.scopeValue,
      title: String(parsed.title ?? ''),
      url: String(parsed.url ?? ''),
      owner: String(parsed.owner ?? ''),
      summary: parsed.summary,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo,
      updatedById: String(parsed.updatedById ?? ''),
      updatedAt: String(parsed.updatedAt ?? ''),
    });
  }

  static serializeDocument(document: AiAlertRunbookDocument): string {
    return JSON.stringify(document);
  }

  static isEffective(document: AiAlertRunbookDocument, asOf: Date): boolean {
    const time = asOf.getTime();
    if (
      document.effectiveFrom &&
      time < new Date(document.effectiveFrom).getTime()
    )
      return false;
    if (
      document.effectiveTo &&
      time >= new Date(document.effectiveTo).getTime()
    )
      return false;
    return true;
  }

  static matchScore(
    document: AiAlertRunbookDocument,
    input: {
      source: string;
      decision: string;
      severity: string;
      scope?: string | null;
      scopeValue?: string | null;
    },
  ): number | null {
    if (document.source !== input.source) return null;
    if (document.decision !== 'ANY' && document.decision !== input.decision)
      return null;
    if (document.severity !== input.severity) return null;
    if (
      document.scope &&
      document.scope.toLowerCase() !== (input.scope ?? '').toLowerCase()
    )
      return null;
    if (
      document.scopeValue &&
      document.scopeValue.toLowerCase() !==
        (input.scopeValue ?? '').toLowerCase()
    )
      return null;
    return (
      (document.decision === input.decision ? 100 : 10) +
      (document.scope ? 20 : 0) +
      (document.scopeValue ? 30 : 0)
    );
  }

  private static requiredText(
    value: string,
    name: string,
    max: number,
  ): string {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${name} is required.`);
    if (normalized.length > max) throw new Error(`${name} is too long.`);
    return normalized;
  }

  private static optionalText(
    value: string | null | undefined,
    max: number,
  ): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) throw new Error('Text is too long.');
    return normalized;
  }

  private static optionalDate(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value.trim() === '')
      return null;
    return this.requiredDate(value);
  }

  private static requiredDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid ISO date.');
    return date.toISOString();
  }

  private static positiveInteger(value: number, name: string): number {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`${name} must be a positive integer.`);
    return value;
  }

  private static assertMember<T extends string>(
    value: T,
    values: readonly T[],
    name: string,
  ): T {
    if (!values.includes(value)) throw new Error(`${name} is invalid.`);
    return value;
  }
}
