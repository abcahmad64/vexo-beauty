import {
  AI_SLO_POLICY_SCHEMA_VERSION,
  AI_SLO_SCOPES,
  AI_SLO_WINDOWS,
  type AiSloPolicyDocument,
  type AiSloScope,
  type AiSloWindow,
} from '../interfaces/ai-slo-error-budget.interface';

export interface AiSloPolicyDatabaseRow {
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

interface CreateAiSloPolicyDocumentInput {
  readonly policyVersion: number;
  readonly scope: AiSloScope;
  readonly scopeValue?: string | null;
  readonly window: AiSloWindow;
  readonly availabilityTargetPercent: number;
  readonly latencyTargetMs?: number | null;
  readonly minimumSampleSize?: number;
  readonly warningBurnRate?: number;
  readonly criticalBurnRate?: number;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly updatedById: string;
  readonly updatedAt?: string;
}

export class AiSloPolicyUtil {
  static createDocument(
    input: CreateAiSloPolicyDocumentInput,
  ): AiSloPolicyDocument {
    const scopeValue = this.normalizeScopeValue(input.scope, input.scopeValue);
    const availabilityTargetPercent = this.assertFiniteNumber(
      input.availabilityTargetPercent,
      'availabilityTargetPercent',
      0.00001,
      100,
    );
    const latencyTargetMs =
      input.latencyTargetMs === undefined || input.latencyTargetMs === null
        ? null
        : this.assertInteger(
            input.latencyTargetMs,
            'latencyTargetMs',
            1,
            3_600_000,
          );
    const minimumSampleSize = this.assertInteger(
      input.minimumSampleSize ?? 30,
      'minimumSampleSize',
      1,
      1_000_000,
    );
    const warningBurnRate = this.assertFiniteNumber(
      input.warningBurnRate ?? 1,
      'warningBurnRate',
      0.01,
      1000,
    );
    const criticalBurnRate = this.assertFiniteNumber(
      input.criticalBurnRate ?? 2,
      'criticalBurnRate',
      0.01,
      1000,
    );

    if (criticalBurnRate < warningBurnRate) {
      throw new Error(
        'criticalBurnRate must be greater than or equal to warningBurnRate.',
      );
    }

    const effectiveFrom = this.normalizeOptionalDate(input.effectiveFrom);
    const effectiveTo = this.normalizeOptionalDate(input.effectiveTo);
    if (
      effectiveFrom &&
      effectiveTo &&
      new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()
    ) {
      throw new Error('effectiveTo must be after effectiveFrom.');
    }

    return {
      schemaVersion: AI_SLO_POLICY_SCHEMA_VERSION,
      policyVersion: this.assertInteger(
        input.policyVersion,
        'policyVersion',
        1,
        Number.MAX_SAFE_INTEGER,
      ),
      scope: input.scope,
      scopeValue,
      window: input.window,
      availabilityTargetPercent,
      latencyTargetMs,
      minimumSampleSize,
      warningBurnRate,
      criticalBurnRate,
      effectiveFrom,
      effectiveTo,
      updatedById: input.updatedById.trim(),
      updatedAt: this.normalizeRequiredDate(
        input.updatedAt ?? new Date().toISOString(),
      ),
    };
  }

  static parseDocument(value: string | null): AiSloPolicyDocument {
    if (!value) throw new Error('SLO policy document is empty.');
    const parsed = JSON.parse(value) as Partial<AiSloPolicyDocument>;

    if (
      parsed.schemaVersion !== AI_SLO_POLICY_SCHEMA_VERSION ||
      !AI_SLO_SCOPES.includes(parsed.scope as AiSloScope) ||
      !AI_SLO_WINDOWS.includes(parsed.window as AiSloWindow) ||
      typeof parsed.updatedById !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      throw new Error('SLO policy document is invalid or unsupported.');
    }

    return this.createDocument({
      policyVersion: Number(parsed.policyVersion),
      scope: parsed.scope as AiSloScope,
      scopeValue: parsed.scopeValue,
      window: parsed.window as AiSloWindow,
      availabilityTargetPercent: Number(parsed.availabilityTargetPercent),
      latencyTargetMs:
        parsed.latencyTargetMs === null || parsed.latencyTargetMs === undefined
          ? null
          : Number(parsed.latencyTargetMs),
      minimumSampleSize: Number(parsed.minimumSampleSize),
      warningBurnRate: Number(parsed.warningBurnRate),
      criticalBurnRate: Number(parsed.criticalBurnRate),
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo,
      updatedById: parsed.updatedById,
      updatedAt: parsed.updatedAt,
    });
  }

  static serializeDocument(document: AiSloPolicyDocument): string {
    return JSON.stringify(document);
  }

  static windowStart(window: AiSloWindow, asOf: Date): Date {
    const durationMs: Record<AiSloWindow, number> = {
      ROLLING_1_HOUR: 60 * 60 * 1000,
      ROLLING_24_HOURS: 24 * 60 * 60 * 1000,
      ROLLING_7_DAYS: 7 * 24 * 60 * 60 * 1000,
      ROLLING_30_DAYS: 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(asOf.getTime() - durationMs[window]);
  }

  private static normalizeScopeValue(
    scope: AiSloScope,
    value?: string | null,
  ): string | null {
    if (scope === 'GLOBAL') return null;
    const normalized = value?.trim() ?? '';
    if (!normalized) throw new Error(`scopeValue is required for ${scope}.`);
    return normalized;
  }

  private static normalizeOptionalDate(value?: string | null): string | null {
    if (value === undefined || value === null || value.trim() === '')
      return null;
    return this.normalizeRequiredDate(value);
  }

  private static normalizeRequiredDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid ISO date.');
    return date.toISOString();
  }

  private static assertInteger(
    value: number,
    name: string,
    min: number,
    max: number,
  ): number {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${name} is outside the allowed integer range.`);
    }
    return value;
  }

  private static assertFiniteNumber(
    value: number,
    name: string,
    min: number,
    max: number,
  ): number {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${name} is outside the allowed numeric range.`);
    }
    return value;
  }
}
