import {
  AI_BUDGET_ENFORCEMENT_VERSION,
  AI_BUDGET_POLICY_SCHEMA_VERSION,
} from '../interfaces/ai-budget-enforcement.interface';

import type {
  AiBudgetDecision,
  AiBudgetExecutionContext,
  AiBudgetPolicyDocument,
  AiBudgetPolicyRecord,
  AiBudgetRunEvidence,
  AiBudgetScope,
  AiBudgetWindow,
} from '../interfaces/ai-budget-enforcement.interface';

export interface AiBudgetPolicyDatabaseRow {
  readonly id: string;
  readonly name: string;
  readonly pattern: string | null;
  readonly isActive: boolean;
  readonly priority: number;
  readonly createdById: string | null;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly deletedAt: Date | string | null;
}

export interface AiBudgetWindowRange {
  readonly start: Date;
  readonly end: Date;
}

export class AiBudgetPolicyUtil {
  static parsePolicy(row: AiBudgetPolicyDatabaseRow): AiBudgetPolicyRecord {
    if (!row.pattern) {
      throw new Error(`AI budget policy ${row.id} has no policy document.`);
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(row.pattern);
    } catch {
      throw new Error(`AI budget policy ${row.id} contains invalid JSON.`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`AI budget policy ${row.id} document is invalid.`);
    }

    const candidate = parsed as Partial<AiBudgetPolicyDocument>;
    const scope = this.assertScope(candidate.scope);
    const scopeValue = this.normalizeScopeValue(scope, candidate.scopeValue);
    const window = this.assertWindow(candidate.window);
    const softLimitMicros = this.assertMicros(
      candidate.softLimitMicros,
      'softLimitMicros',
    );
    const hardLimitMicros = this.assertMicros(
      candidate.hardLimitMicros,
      'hardLimitMicros',
    );

    if (BigInt(softLimitMicros) > BigInt(hardLimitMicros)) {
      throw new Error(
        `AI budget policy ${row.id} soft limit exceeds its hard limit.`,
      );
    }

    const policyVersion = Number(candidate.policyVersion);

    if (!Number.isInteger(policyVersion) || policyVersion < 1) {
      throw new Error(`AI budget policy ${row.id} version is invalid.`);
    }

    const unknownPricingMode =
      candidate.unknownPricingMode === 'WARN' ||
      candidate.unknownPricingMode === 'BLOCK'
        ? candidate.unknownPricingMode
        : null;

    if (!unknownPricingMode) {
      throw new Error(
        `AI budget policy ${row.id} unknown-pricing mode is invalid.`,
      );
    }

    const effectiveFrom = this.normalizeOptionalDate(
      candidate.effectiveFrom,
      'effectiveFrom',
    );
    const effectiveTo = this.normalizeOptionalDate(
      candidate.effectiveTo,
      'effectiveTo',
    );

    if (
      effectiveFrom &&
      effectiveTo &&
      new Date(effectiveFrom).getTime() >= new Date(effectiveTo).getTime()
    ) {
      throw new Error(
        `AI budget policy ${row.id} effective date range is invalid.`,
      );
    }

    if (candidate.schemaVersion !== AI_BUDGET_POLICY_SCHEMA_VERSION) {
      throw new Error(
        `AI budget policy ${row.id} schema version is unsupported.`,
      );
    }

    return Object.freeze({
      id: row.id,
      name: row.name,
      schemaVersion: AI_BUDGET_POLICY_SCHEMA_VERSION,
      policyVersion,
      scope,
      scopeValue,
      window,
      softLimitMicros,
      hardLimitMicros,
      unknownPricingMode,
      effectiveFrom,
      effectiveTo,
      updatedById: this.normalizeOptionalString(candidate.updatedById),
      isActive: row.isActive,
      priority: row.priority,
      createdById: row.createdById,
      createdAt: this.toIsoString(row.createdAt),
      updatedAt: this.toIsoString(row.updatedAt),
      deletedAt: row.deletedAt ? this.toIsoString(row.deletedAt) : null,
    });
  }

  static createDocument(input: {
    readonly policyVersion: number;
    readonly scope: AiBudgetScope;
    readonly scopeValue?: string | null;
    readonly window: AiBudgetWindow;
    readonly softLimitMicros: string;
    readonly hardLimitMicros: string;
    readonly unknownPricingMode?: 'WARN' | 'BLOCK';
    readonly effectiveFrom?: string | null;
    readonly effectiveTo?: string | null;
    readonly updatedById?: string | null;
  }): AiBudgetPolicyDocument {
    const scope = this.assertScope(input.scope);
    const scopeValue = this.normalizeScopeValue(scope, input.scopeValue);
    const window = this.assertWindow(input.window);
    const softLimitMicros = this.assertMicros(
      input.softLimitMicros,
      'softLimitMicros',
    );
    const hardLimitMicros = this.assertMicros(
      input.hardLimitMicros,
      'hardLimitMicros',
    );

    if (BigInt(softLimitMicros) > BigInt(hardLimitMicros)) {
      throw new Error('Soft budget limit cannot exceed hard budget limit.');
    }

    if (!Number.isInteger(input.policyVersion) || input.policyVersion < 1) {
      throw new Error('Budget policy version must be a positive integer.');
    }

    const effectiveFrom = this.normalizeOptionalDate(
      input.effectiveFrom,
      'effectiveFrom',
    );
    const effectiveTo = this.normalizeOptionalDate(
      input.effectiveTo,
      'effectiveTo',
    );

    if (
      effectiveFrom &&
      effectiveTo &&
      new Date(effectiveFrom).getTime() >= new Date(effectiveTo).getTime()
    ) {
      throw new Error('Budget policy effective date range is invalid.');
    }

    return Object.freeze({
      schemaVersion: AI_BUDGET_POLICY_SCHEMA_VERSION,
      policyVersion: input.policyVersion,
      scope,
      scopeValue,
      window,
      softLimitMicros,
      hardLimitMicros,
      unknownPricingMode: input.unknownPricingMode ?? 'BLOCK',
      effectiveFrom,
      effectiveTo,
      updatedById: this.normalizeOptionalString(input.updatedById),
    });
  }

  static serializeDocument(document: AiBudgetPolicyDocument): string {
    return JSON.stringify(document);
  }

  static isEffective(policy: AiBudgetPolicyRecord, now: Date): boolean {
    if (!policy.isActive || policy.deletedAt) {
      return false;
    }

    const timestamp = now.getTime();

    if (
      policy.effectiveFrom &&
      timestamp < new Date(policy.effectiveFrom).getTime()
    ) {
      return false;
    }

    if (
      policy.effectiveTo &&
      timestamp >= new Date(policy.effectiveTo).getTime()
    ) {
      return false;
    }

    return true;
  }

  static matchesContext(
    policy: Pick<AiBudgetPolicyRecord, 'scope' | 'scopeValue'>,
    context: AiBudgetExecutionContext,
  ): boolean {
    switch (policy.scope) {
      case 'GLOBAL':
        return true;
      case 'USER':
        return this.equalsNormalized(policy.scopeValue, context.userId);
      case 'AGENT':
        return this.equalsNormalized(policy.scopeValue, context.agentId);
      case 'PROVIDER':
        return this.equalsNormalized(policy.scopeValue, context.provider);
      case 'MODEL':
        return this.equalsNormalized(policy.scopeValue, context.model);
      case 'TASK':
        return this.equalsNormalized(policy.scopeValue, context.taskType);
    }
  }

  static resolveWindowRange(
    window: AiBudgetWindow,
    now: Date,
  ): AiBudgetWindowRange {
    const end = new Date(now);

    if (window === 'ROLLING_24_HOURS') {
      return {
        start: new Date(end.getTime() - 24 * 60 * 60 * 1000),
        end,
      };
    }

    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    if (window === 'WEEKLY') {
      const day = start.getUTCDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;

      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    } else if (window === 'MONTHLY') {
      start.setUTCDate(1);
    }

    const fixedEnd = new Date(start);

    if (window === 'DAILY') {
      fixedEnd.setUTCDate(fixedEnd.getUTCDate() + 1);
    } else if (window === 'WEEKLY') {
      fixedEnd.setUTCDate(fixedEnd.getUTCDate() + 7);
    } else {
      fixedEnd.setUTCMonth(fixedEnd.getUTCMonth() + 1);
    }

    return {
      start,
      end: fixedEnd,
    };
  }

  static strongestDecision(
    decisions: readonly AiBudgetDecision[],
  ): AiBudgetDecision {
    if (decisions.includes('BLOCK')) {
      return 'BLOCK';
    }

    if (decisions.includes('WARN')) {
      return 'WARN';
    }

    if (decisions.includes('ALLOW')) {
      return 'ALLOW';
    }

    return 'NO_POLICY';
  }

  static readRunEvidence(inputJson: unknown): AiBudgetRunEvidence {
    const input = this.toRecord(inputJson);
    const candidate = this.toRecord(input.budgetEnforcement);
    const decisions = Array.isArray(candidate.decisions)
      ? candidate.decisions.filter(
          (item): item is AiBudgetRunEvidence['decisions'][number] =>
            Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        )
      : [];
    const reservations = Array.isArray(candidate.reservations)
      ? candidate.reservations.filter(
          (item): item is AiBudgetRunEvidence['reservations'][number] =>
            Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        )
      : [];

    return {
      version: AI_BUDGET_ENFORCEMENT_VERSION,
      decisions,
      reservations,
    };
  }

  static writeRunEvidence(
    inputJson: unknown,
    evidence: AiBudgetRunEvidence,
  ): Record<string, unknown> {
    return {
      ...this.toRecord(inputJson),
      budgetEnforcement: evidence,
    };
  }

  static normalizeContext(input: {
    readonly runLogId?: string | null;
    readonly taskType: string;
    readonly userId?: string | null;
    readonly provider?: string | null;
    readonly model?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): AiBudgetExecutionContext {
    const metadata = input.metadata ?? {};

    return Object.freeze({
      runLogId: this.normalizeOptionalString(input.runLogId),
      taskType: this.normalizeRequiredString(input.taskType, 'taskType'),
      userId: this.normalizeOptionalString(input.userId),
      provider:
        this.normalizeOptionalString(input.provider)?.toLowerCase() ?? null,
      model: this.normalizeOptionalString(input.model),
      agentId: this.normalizeOptionalString(metadata.agentId),
      executionId: this.normalizeOptionalString(metadata.executionId),
      correlationId: this.normalizeOptionalString(metadata.correlationId),
      requestId: this.normalizeOptionalString(metadata.requestId),
    });
  }

  private static assertScope(value: unknown): AiBudgetScope {
    if (
      value === 'GLOBAL' ||
      value === 'USER' ||
      value === 'AGENT' ||
      value === 'PROVIDER' ||
      value === 'MODEL' ||
      value === 'TASK'
    ) {
      return value;
    }

    throw new Error('Budget policy scope is invalid.');
  }

  private static assertWindow(value: unknown): AiBudgetWindow {
    if (
      value === 'DAILY' ||
      value === 'WEEKLY' ||
      value === 'MONTHLY' ||
      value === 'ROLLING_24_HOURS'
    ) {
      return value;
    }

    throw new Error('Budget policy window is invalid.');
  }

  private static normalizeScopeValue(
    scope: AiBudgetScope,
    value: unknown,
  ): string | null {
    if (scope === 'GLOBAL') {
      return null;
    }

    const normalized = this.normalizeOptionalString(value);

    if (!normalized) {
      throw new Error(`Budget scope ${scope} requires a scope value.`);
    }

    return normalized;
  }

  private static assertMicros(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
      throw new Error(`${field} must be a non-negative integer string.`);
    }

    return BigInt(value).toString();
  }

  private static normalizeOptionalDate(
    value: unknown,
    field: string,
  ): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new Error(`${field} must be an ISO date string.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`${field} must be an ISO date string.`);
    }

    return date.toISOString();
  }

  private static equalsNormalized(
    left: string | null,
    right: string | null,
  ): boolean {
    if (!left || !right) {
      return false;
    }

    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  private static normalizeRequiredString(
    value: unknown,
    field: string,
  ): string {
    const normalized = this.normalizeOptionalString(value);

    if (!normalized) {
      throw new Error(`${field} is required.`);
    }

    return normalized;
  }

  private static normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized.slice(0, 240) : null;
  }

  private static toIsoString(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error('Budget policy database date is invalid.');
    }

    return date.toISOString();
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
