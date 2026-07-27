import { createHash } from 'crypto';
import {
  AI_MODEL_ROLLOUT_SCHEMA_VERSION,
  type AiModelRolloutDocument,
} from '../interfaces/ai-model-rollout-canary.interface';

export class AiModelRolloutCanaryUtil {
  static createDocument(
    input: Omit<AiModelRolloutDocument, 'schemaVersion' | 'updatedAt'> & {
      updatedAt?: string;
    },
  ): AiModelRolloutDocument {
    const updatedAt = new Date(input.updatedAt ?? new Date().toISOString());
    if (Number.isNaN(updatedAt.getTime()))
      throw new Error('Invalid updatedAt.');
    if (
      input.baselineModel === input.candidateModel &&
      input.baselineProvider === input.candidateProvider
    ) {
      throw new Error('Baseline and candidate must differ.');
    }
    if (
      input.effectiveFrom &&
      input.effectiveTo &&
      new Date(input.effectiveFrom) >= new Date(input.effectiveTo)
    ) {
      throw new Error('effectiveFrom must be before effectiveTo.');
    }
    return {
      schemaVersion: AI_MODEL_ROLLOUT_SCHEMA_VERSION,
      policyVersion: this.integer(
        input.policyVersion,
        'policyVersion',
        1,
        1000000,
      ),
      baselineProvider: this.text(input.baselineProvider, 'baselineProvider'),
      baselineModel: this.text(input.baselineModel, 'baselineModel'),
      candidateProvider: this.text(
        input.candidateProvider,
        'candidateProvider',
      ),
      candidateModel: this.text(input.candidateModel, 'candidateModel'),
      taskType: input.taskType?.trim() || null,
      trafficPercent: this.number(
        input.trafficPercent,
        'trafficPercent',
        0,
        100,
      ),
      cohortSalt: this.text(input.cohortSalt, 'cohortSalt'),
      minimumSampleSize: this.integer(
        input.minimumSampleSize,
        'minimumSampleSize',
        1,
        100000,
      ),
      maxFailureRateIncreasePercent: this.number(
        input.maxFailureRateIncreasePercent,
        'maxFailureRateIncreasePercent',
        0,
        1000,
      ),
      maxP95LatencyIncreasePercent: this.number(
        input.maxP95LatencyIncreasePercent,
        'maxP95LatencyIncreasePercent',
        0,
        1000,
      ),
      maxCostIncreasePercent:
        input.maxCostIncreasePercent == null
          ? null
          : this.number(
              input.maxCostIncreasePercent,
              'maxCostIncreasePercent',
              0,
              1000,
            ),
      effectiveFrom: input.effectiveFrom
        ? new Date(input.effectiveFrom).toISOString()
        : null,
      effectiveTo: input.effectiveTo
        ? new Date(input.effectiveTo).toISOString()
        : null,
      updatedById: this.text(input.updatedById, 'updatedById'),
      updatedAt: updatedAt.toISOString(),
    };
  }

  static serializeDocument(document: AiModelRolloutDocument): string {
    return JSON.stringify(document);
  }

  static parseDocument(value: string | null): AiModelRolloutDocument {
    if (!value) throw new Error('Missing rollout document.');
    return this.createDocument(JSON.parse(value) as AiModelRolloutDocument);
  }

  static bucket(subjectKey: string, cohortSalt: string): number {
    const digest = createHash('sha256')
      .update(`${cohortSalt}:${subjectKey}`)
      .digest();
    return digest.readUInt32BE(0) % 10000;
  }

  static resolveCohort(
    subjectKey: string,
    cohortSalt: string,
    trafficPercent: number,
  ) {
    const bucket = this.bucket(subjectKey, cohortSalt);
    const threshold = Math.round(trafficPercent * 100);
    return {
      bucket,
      threshold,
      cohort:
        bucket < threshold ? ('CANDIDATE' as const) : ('BASELINE' as const),
      stable: true,
      routingMutation: false,
    };
  }

  private static text(value: string, name: string): string {
    const normalized = String(value).trim();
    if (!normalized) throw new Error(`${name} is required.`);
    return normalized;
  }
  private static integer(
    value: number,
    name: string,
    min: number,
    max: number,
  ) {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${name} is outside the allowed integer range.`);
    }
    return value;
  }
  private static number(value: number, name: string, min: number, max: number) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${name} is outside the allowed numeric range.`);
    }
    return value;
  }
}
