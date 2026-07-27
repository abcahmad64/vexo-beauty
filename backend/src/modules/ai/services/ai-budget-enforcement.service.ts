import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { QueryAiBudgetUsageDto } from '../dto/query-ai-budget-usage.dto';

import { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';

import {
  AI_BUDGET_ENFORCEMENT_VERSION,
  AI_BUDGET_POLICY_RULE_TYPE,
} from '../interfaces/ai-budget-enforcement.interface';

import type {
  AiBudgetCostEstimate,
  AiBudgetDecision,
  AiBudgetDecisionEvidence,
  AiBudgetExecutionContext,
  AiBudgetPolicyDecisionEvidence,
  AiBudgetPolicyRecord,
  AiBudgetReservationEvidence,
  AiBudgetReservationResult,
} from '../interfaces/ai-budget-enforcement.interface';

import { AI_PROVIDER_COST_ACCOUNTING_VERSION } from '../interfaces/ai-provider-cost-accounting.interface';

import type {
  AiProviderCostAccountingAttempt,
  AiProviderCostAccountingSummary,
  AiProviderTokenUsage,
} from '../interfaces/ai-provider-cost-accounting.interface';

import type { AiChatMessage } from '../interfaces/ai-provider.interface';

import { AiBudgetPolicyUtil } from './ai-budget-policy.util';

import { AiProviderCostAccountingUtil } from './ai-provider-cost-accounting.util';

import { resolveAiProviderPricing } from './ai-provider-pricing-catalog';

const POLICY_SELECT = {
  id: true,
  name: true,
  pattern: true,
  isActive: true,
  priority: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

const RUN_SELECT = {
  id: true,
  taskType: true,
  userId: true,
  provider: true,
  model: true,
  inputJson: true,
  tokenUsageJson: true,
  createdAt: true,
  deletedAt: true,
} as const;

type BudgetRunRow = {
  readonly id: string;
  readonly taskType: string;
  readonly userId: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly inputJson: unknown;
  readonly tokenUsageJson: unknown;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
};

type BudgetLedgerEntry = {
  readonly context: AiBudgetExecutionContext;
  readonly occurredAt: Date;
  readonly costMicros: bigint | null;
  readonly kind: 'ACTUAL' | 'ACTIVE_RESERVATION';
  readonly pricingStatus: 'CALCULATED' | 'UNPRICED';
};

type PolicyUsage = {
  readonly actualCostMicros: bigint;
  readonly activeReservationMicros: bigint;
  readonly pricedEntryCount: number;
  readonly unpricedEntryCount: number;
};

export interface ReserveAiBudgetInput {
  readonly runLogId: string | null;
  readonly taskType: string;
  readonly userId?: string | null;
  readonly provider: string;
  readonly model: string;
  readonly metadata?: Record<string, unknown>;
  readonly estimate: AiBudgetCostEstimate;
  readonly attemptSequence: number;
  readonly attemptKind: 'PRIMARY' | 'FALLBACK' | 'EMBEDDING';
}

export interface ReconcileAiBudgetInput {
  readonly runLogId: string | null;
  readonly reservationId: string | null;
  readonly providerAttempt: AiProviderCostAccountingAttempt;
}

type BudgetReservationTransactionResult = {
  readonly result: AiBudgetReservationResult;
  readonly failureReason: 'RUN_LOG_REQUIRED' | 'POLICY_BLOCK' | null;
};

@Injectable()
export class AiBudgetEnforcementService {
  private readonly logger = new Logger(AiBudgetEnforcementService.name);

  constructor(private readonly prisma: PrismaService) {}

  estimateChat(input: {
    readonly provider: string;
    readonly model: string;
    readonly messages: readonly AiChatMessage[];
    readonly maxOutputTokens: number;
  }): AiBudgetCostEstimate {
    const inputCharacters = input.messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );

    return this.estimateProviderCost({
      provider: input.provider,
      model: input.model,
      estimatedInputTokens: this.estimateTokens(inputCharacters),
      estimatedOutputTokens: Math.max(0, Math.trunc(input.maxOutputTokens)),
    });
  }

  estimateEmbedding(input: {
    readonly provider: string;
    readonly model: string;
    readonly values: readonly string[];
  }): AiBudgetCostEstimate {
    const inputCharacters = input.values.reduce(
      (sum, value) => sum + value.length,
      0,
    );

    return this.estimateProviderCost({
      provider: input.provider,
      model: input.model,
      estimatedInputTokens: this.estimateTokens(inputCharacters),
      estimatedOutputTokens: 0,
    });
  }

  async preflightQueue(input: {
    readonly taskType: string;
    readonly userId?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<AiBudgetDecision> {
    const context = AiBudgetPolicyUtil.normalizeContext({
      runLogId: null,
      taskType: input.taskType,
      userId: input.userId,
      provider: null,
      model: null,
      metadata: input.metadata,
    });
    const now = new Date();

    try {
      const policies = (await this.loadPolicies(this.prisma)).filter(
        (policy) =>
          AiBudgetPolicyUtil.isEffective(policy, now) &&
          AiBudgetPolicyUtil.matchesContext(policy, context),
      );

      if (policies.length === 0) {
        return 'NO_POLICY';
      }

      const rows = await this.loadUsageRows(
        this.prisma,
        this.resolveEarliestWindowStart(policies, now),
      );
      const decisions = this.evaluatePolicies({
        policies,
        context,
        estimate: {
          pricingStatus: 'NOT_EVALUATED',
          estimatedCostMicros: null,
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
        },
        rows,
        now,
      });
      const decision = AiBudgetPolicyUtil.strongestDecision(
        decisions.map((item) => item.decision),
      );

      if (decision === 'BLOCK') {
        throw this.createBlockException(decisions);
      }

      return decision;
    } catch (error) {
      if (AiBudgetEnforcementException.isBudgetEnforcementException(error)) {
        throw error;
      }

      throw new AiBudgetEnforcementException(
        'ENFORCEMENT_UNAVAILABLE',
        'کنترل بودجه هوش مصنوعی در دسترس نیست و اجرای Provider به‌صورت ایمن متوقف شد.',
        {
          cause: this.getErrorMessage(error),
          phase: 'QUEUE_PREFLIGHT',
        },
      );
    }
  }

  async reserve(
    input: ReserveAiBudgetInput,
  ): Promise<AiBudgetReservationResult> {
    const context = AiBudgetPolicyUtil.normalizeContext(input);
    const reservationId = this.createReservationId(input, context);
    const now = new Date();

    try {
      const transactionResult = await this.prisma.$transaction(
        async (tx): Promise<BudgetReservationTransactionResult> => {
          const policies = (await this.loadPolicies(tx)).filter(
            (policy) =>
              AiBudgetPolicyUtil.isEffective(policy, now) &&
              AiBudgetPolicyUtil.matchesContext(policy, context),
          );

          if (policies.length === 0) {
            return {
              result: {
                version: AI_BUDGET_ENFORCEMENT_VERSION,
                decision: 'NO_POLICY' as const,
                reservationId: null,
                policyDecisions: [],
                estimate: input.estimate,
              },
              failureReason: null,
            };
          }

          if (!context.runLogId) {
            return {
              result: {
                version: AI_BUDGET_ENFORCEMENT_VERSION,
                decision: 'BLOCK' as const,
                reservationId: null,
                policyDecisions: [],
                estimate: input.estimate,
              },
              failureReason: 'RUN_LOG_REQUIRED' as const,
            };
          }

          await this.acquirePolicyLocks(tx, policies, now);

          const run = await tx.aiRunLog.findFirst({
            where: {
              id: context.runLogId,
              deletedAt: null,
            },
            select: RUN_SELECT,
          });

          if (!run) {
            return {
              result: {
                version: AI_BUDGET_ENFORCEMENT_VERSION,
                decision: 'BLOCK' as const,
                reservationId: null,
                policyDecisions: [],
                estimate: input.estimate,
              },
              failureReason: 'RUN_LOG_REQUIRED' as const,
            };
          }

          const existingEvidence = AiBudgetPolicyUtil.readRunEvidence(
            run.inputJson,
          );
          const existingReservation = existingEvidence.reservations.find(
            (item) => item.reservationId === reservationId,
          );

          if (existingReservation) {
            return {
              result: {
                version: AI_BUDGET_ENFORCEMENT_VERSION,
                decision: AiBudgetPolicyUtil.strongestDecision(
                  existingReservation.policyDecisions.map(
                    (item) => item.decision,
                  ),
                ),
                reservationId,
                policyDecisions: existingReservation.policyDecisions,
                estimate: input.estimate,
              },
              failureReason: null,
            };
          }

          const rows = await this.loadUsageRows(
            tx,
            this.resolveEarliestWindowStart(policies, now),
          );
          const policyDecisions = this.evaluatePolicies({
            policies,
            context,
            estimate: input.estimate,
            rows,
            now,
          });
          const decision = AiBudgetPolicyUtil.strongestDecision(
            policyDecisions.map((item) => item.decision),
          );
          const decisionEvidence: AiBudgetDecisionEvidence = Object.freeze({
            version: AI_BUDGET_ENFORCEMENT_VERSION,
            decisionId: this.createDecisionId(reservationId, decision),
            decision,
            context,
            pricingStatus: input.estimate.pricingStatus,
            estimatedCostMicros: input.estimate.estimatedCostMicros,
            policyDecisions,
            decidedAt: now.toISOString(),
          });
          const decisions = [
            ...existingEvidence.decisions,
            decisionEvidence,
          ].slice(-100);

          if (decision === 'BLOCK') {
            await tx.aiRunLog.update({
              where: {
                id: run.id,
              },
              data: {
                inputJson: this.toInputJson(
                  AiBudgetPolicyUtil.writeRunEvidence(run.inputJson, {
                    version: AI_BUDGET_ENFORCEMENT_VERSION,
                    decisions,
                    reservations: existingEvidence.reservations,
                  }),
                ),
              },
            });

            return {
              result: {
                version: AI_BUDGET_ENFORCEMENT_VERSION,
                decision,
                reservationId: null,
                policyDecisions,
                estimate: input.estimate,
              },
              failureReason: 'POLICY_BLOCK' as const,
            };
          }

          const reservation: AiBudgetReservationEvidence = Object.freeze({
            version: AI_BUDGET_ENFORCEMENT_VERSION,
            reservationId,
            status: 'RESERVED',
            attemptSequence: input.attemptSequence,
            attemptKind: input.attemptKind,
            context,
            pricingStatus: input.estimate.pricingStatus,
            estimatedCostMicros: input.estimate.estimatedCostMicros,
            actualCostMicros: null,
            deltaCostMicros: null,
            providerAttemptId: null,
            providerAttemptStatus: null,
            policyDecisions,
            reservedAt: now.toISOString(),
            reconciledAt: null,
          });

          await tx.aiRunLog.update({
            where: {
              id: run.id,
            },
            data: {
              inputJson: this.toInputJson(
                AiBudgetPolicyUtil.writeRunEvidence(run.inputJson, {
                  version: AI_BUDGET_ENFORCEMENT_VERSION,
                  decisions,
                  reservations: [
                    ...existingEvidence.reservations,
                    reservation,
                  ].slice(-50),
                }),
              ),
            },
          });

          return {
            result: {
              version: AI_BUDGET_ENFORCEMENT_VERSION,
              decision,
              reservationId,
              policyDecisions,
              estimate: input.estimate,
            },
            failureReason: null,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (transactionResult.failureReason === 'RUN_LOG_REQUIRED') {
        throw new AiBudgetEnforcementException(
          'RUN_LOG_REQUIRED',
          'ثبت Run Log برای رزرو اتمیک بودجه هوش مصنوعی الزامی است.',
          {
            taskType: context.taskType,
            provider: context.provider,
            model: context.model,
          },
        );
      }

      if (transactionResult.failureReason === 'POLICY_BLOCK') {
        throw this.createBlockException(
          transactionResult.result.policyDecisions,
        );
      }

      return transactionResult.result;
    } catch (error) {
      if (AiBudgetEnforcementException.isBudgetEnforcementException(error)) {
        throw error;
      }

      throw new AiBudgetEnforcementException(
        'ENFORCEMENT_UNAVAILABLE',
        'رزرو اتمیک بودجه هوش مصنوعی ناموفق بود و فراخوانی Provider متوقف شد.',
        {
          cause: this.getErrorMessage(error),
          phase: 'PROVIDER_RESERVATION',
          reservationId,
        },
      );
    }
  }

  async reconcile(input: ReconcileAiBudgetInput): Promise<void> {
    const runLogId = input.runLogId;
    const reservationId = input.reservationId;

    if (!runLogId || !reservationId) {
      return;
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const run = await tx.aiRunLog.findFirst({
            where: {
              id: runLogId,
              deletedAt: null,
            },
            select: RUN_SELECT,
          });

          if (!run) {
            return;
          }

          const evidence = AiBudgetPolicyUtil.readRunEvidence(run.inputJson);
          const reservation = evidence.reservations.find(
            (item) => item.reservationId === reservationId,
          );

          if (!reservation || reservation.status === 'RECONCILED') {
            return;
          }

          await this.acquireReservationPolicyLocks(
            tx,
            reservation.policyDecisions,
          );

          const actualCostMicros =
            input.providerAttempt.cost.status === 'CALCULATED'
              ? (input.providerAttempt.cost.totalCostMicros ?? '0')
              : null;
          const deltaCostMicros =
            actualCostMicros !== null &&
            reservation.estimatedCostMicros !== null
              ? (
                  BigInt(actualCostMicros) -
                  BigInt(reservation.estimatedCostMicros)
                ).toString()
              : null;
          const reconciled: AiBudgetReservationEvidence = Object.freeze({
            ...reservation,
            status: 'RECONCILED',
            actualCostMicros,
            deltaCostMicros,
            providerAttemptId: input.providerAttempt.attemptId,
            providerAttemptStatus: input.providerAttempt.status,
            reconciledAt: new Date().toISOString(),
          });

          await tx.aiRunLog.update({
            where: {
              id: run.id,
            },
            data: {
              inputJson: this.toInputJson(
                AiBudgetPolicyUtil.writeRunEvidence(run.inputJson, {
                  version: AI_BUDGET_ENFORCEMENT_VERSION,
                  decisions: evidence.decisions,
                  reservations: evidence.reservations.map((item) =>
                    item.reservationId === reservationId ? reconciled : item,
                  ),
                }),
              ),
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.logger.error(
        `AI budget reconciliation failed for ${reservationId}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getUsageReport(query: QueryAiBudgetUsageDto = {}) {
    const now = new Date();
    const policies = (await this.loadPolicies(this.prisma, true))
      .filter((policy) =>
        query.policyId ? policy.id === query.policyId : true,
      )
      .filter((policy) =>
        query.includeInactive
          ? !policy.deletedAt
          : AiBudgetPolicyUtil.isEffective(policy, now),
      );

    if (policies.length === 0) {
      return {
        version: AI_BUDGET_ENFORCEMENT_VERSION,
        currency: 'USD',
        costUnit: 'INTEGER_MICRO_USD',
        costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
        generatedAt: now.toISOString(),
        policies: [],
      };
    }

    const rows = await this.loadUsageRows(
      this.prisma,
      this.resolveEarliestWindowStart(policies, now),
    );

    return {
      version: AI_BUDGET_ENFORCEMENT_VERSION,
      currency: 'USD',
      costUnit: 'INTEGER_MICRO_USD',
      costBasis: 'PROVIDER_TOKEN_FEE_ONLY',
      generatedAt: now.toISOString(),
      policies: policies.map((policy) => {
        const range = AiBudgetPolicyUtil.resolveWindowRange(policy.window, now);
        const usage = this.calculatePolicyUsage(policy, rows, range);
        const committed =
          usage.actualCostMicros + usage.activeReservationMicros;
        const hardLimit = BigInt(policy.hardLimitMicros);
        const remaining = hardLimit > committed ? hardLimit - committed : 0n;

        return {
          policy,
          windowStart: range.start.toISOString(),
          windowEnd: range.end.toISOString(),
          actualCostMicros: usage.actualCostMicros.toString(),
          activeReservationMicros: usage.activeReservationMicros.toString(),
          committedCostMicros: committed.toString(),
          remainingHardLimitMicros: remaining.toString(),
          softLimitReached: committed >= BigInt(policy.softLimitMicros),
          hardLimitReached: committed >= hardLimit,
          pricedEntryCount: usage.pricedEntryCount,
          unpricedEntryCount: usage.unpricedEntryCount,
        };
      }),
    };
  }

  private estimateProviderCost(input: {
    readonly provider: string;
    readonly model: string;
    readonly estimatedInputTokens: number;
    readonly estimatedOutputTokens: number;
  }): AiBudgetCostEstimate {
    const pricing = resolveAiProviderPricing(input.provider, input.model);

    if (!pricing) {
      return Object.freeze({
        pricingStatus: 'UNPRICED',
        estimatedCostMicros: null,
        estimatedInputTokens: input.estimatedInputTokens,
        estimatedOutputTokens: input.estimatedOutputTokens,
      });
    }

    const usage: AiProviderTokenUsage = Object.freeze({
      inputTokens: input.estimatedInputTokens,
      outputTokens: input.estimatedOutputTokens,
      totalTokens: input.estimatedInputTokens + input.estimatedOutputTokens,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      reported: false,
      source: 'UNREPORTED',
    });
    const cost = AiProviderCostAccountingUtil.calculateCost(usage, pricing);

    return Object.freeze({
      pricingStatus: 'CALCULATED',
      estimatedCostMicros: cost.totalCostMicros ?? '0',
      estimatedInputTokens: input.estimatedInputTokens,
      estimatedOutputTokens: input.estimatedOutputTokens,
    });
  }

  private estimateTokens(characterCount: number): number {
    if (!Number.isFinite(characterCount) || characterCount <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(characterCount / 3));
  }

  private async loadPolicies(
    client: Pick<PrismaService, 'aiGuardrailRule'> | Prisma.TransactionClient,
    includeInactive = false,
  ): Promise<AiBudgetPolicyRecord[]> {
    const rows = await client.aiGuardrailRule.findMany({
      where: {
        ruleType: AI_BUDGET_POLICY_RULE_TYPE,
        deletedAt: null,
        ...(includeInactive
          ? {}
          : {
              isActive: true,
            }),
      },
      select: POLICY_SELECT,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    try {
      return rows.map((row) => AiBudgetPolicyUtil.parsePolicy(row));
    } catch (error) {
      throw new AiBudgetEnforcementException(
        'POLICY_INVALID',
        'حداقل یک سیاست بودجه هوش مصنوعی ساختار معتبر ندارد.',
        {
          cause: this.getErrorMessage(error),
        },
      );
    }
  }

  private async loadUsageRows(
    client: Pick<PrismaService, 'aiRunLog'> | Prisma.TransactionClient,
    start: Date,
  ): Promise<BudgetRunRow[]> {
    return client.aiRunLog.findMany({
      where: {
        deletedAt: null,
        createdAt: {
          gte: start,
        },
      },
      select: RUN_SELECT,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private evaluatePolicies(input: {
    readonly policies: readonly AiBudgetPolicyRecord[];
    readonly context: AiBudgetExecutionContext;
    readonly estimate: AiBudgetCostEstimate;
    readonly rows: readonly BudgetRunRow[];
    readonly now: Date;
  }): AiBudgetPolicyDecisionEvidence[] {
    return input.policies.map((policy) => {
      const range = AiBudgetPolicyUtil.resolveWindowRange(
        policy.window,
        input.now,
      );
      const usage = this.calculatePolicyUsage(policy, input.rows, range);
      const requested =
        input.estimate.pricingStatus === 'CALCULATED'
          ? BigInt(input.estimate.estimatedCostMicros ?? '0')
          : null;
      const committed = usage.actualCostMicros + usage.activeReservationMicros;
      const projected = requested === null ? null : committed + requested;
      const decision = this.resolvePolicyDecision({
        policy,
        estimate: input.estimate,
        committed,
        projected,
      });

      return Object.freeze({
        policyId: policy.id,
        policyVersion: policy.policyVersion,
        scope: policy.scope,
        scopeValue: policy.scopeValue,
        window: policy.window,
        windowStart: range.start.toISOString(),
        windowEnd: range.end.toISOString(),
        decision,
        pricingStatus: input.estimate.pricingStatus,
        softLimitMicros: policy.softLimitMicros,
        hardLimitMicros: policy.hardLimitMicros,
        actualCostMicros: usage.actualCostMicros.toString(),
        activeReservationMicros: usage.activeReservationMicros.toString(),
        requestedReservationMicros: requested?.toString() ?? null,
        projectedCostMicros: projected?.toString() ?? null,
        unknownPricingMode: policy.unknownPricingMode,
      });
    });
  }

  private resolvePolicyDecision(input: {
    readonly policy: AiBudgetPolicyRecord;
    readonly estimate: AiBudgetCostEstimate;
    readonly committed: bigint;
    readonly projected: bigint | null;
  }): Exclude<AiBudgetDecision, 'NO_POLICY'> {
    if (input.estimate.pricingStatus === 'UNPRICED') {
      return input.policy.unknownPricingMode;
    }

    const hardLimit = BigInt(input.policy.hardLimitMicros);
    const softLimit = BigInt(input.policy.softLimitMicros);
    const value = input.projected ?? input.committed;

    if (value > hardLimit) {
      return 'BLOCK';
    }

    if (value > softLimit) {
      return 'WARN';
    }

    return 'ALLOW';
  }

  private calculatePolicyUsage(
    policy: AiBudgetPolicyRecord,
    rows: readonly BudgetRunRow[],
    range: { readonly start: Date; readonly end: Date },
  ): PolicyUsage {
    const usage = {
      actualCostMicros: 0n,
      activeReservationMicros: 0n,
      pricedEntryCount: 0,
      unpricedEntryCount: 0,
    };

    for (const row of rows) {
      for (const entry of this.extractLedgerEntries(row)) {
        if (
          entry.occurredAt < range.start ||
          entry.occurredAt >= range.end ||
          !AiBudgetPolicyUtil.matchesContext(policy, entry.context)
        ) {
          continue;
        }

        if (entry.pricingStatus === 'UNPRICED' || entry.costMicros === null) {
          usage.unpricedEntryCount += 1;
          continue;
        }

        usage.pricedEntryCount += 1;

        if (entry.kind === 'ACTIVE_RESERVATION') {
          usage.activeReservationMicros += entry.costMicros;
        } else {
          usage.actualCostMicros += entry.costMicros;
        }
      }
    }

    return usage;
  }

  private extractLedgerEntries(row: BudgetRunRow): BudgetLedgerEntry[] {
    const summary = this.parseAccountingSummary(row.tokenUsageJson);
    const evidence = AiBudgetPolicyUtil.readRunEvidence(row.inputJson);
    const entries: BudgetLedgerEntry[] = [];

    const accountedReservationKeys = new Set<string>();

    if (summary) {
      for (const attempt of summary.attempts) {
        const reservation = evidence.reservations.find((item) =>
          this.matchesReservationAttempt(item, attempt),
        );

        if (reservation) {
          accountedReservationKeys.add(
            this.createReservationAttemptKey(reservation),
          );
        }

        entries.push({
          context:
            reservation?.context ??
            AiBudgetPolicyUtil.normalizeContext({
              runLogId: row.id,
              taskType: attempt.lineage.taskType || row.taskType,
              userId: row.userId,
              provider: attempt.provider,
              model: attempt.model,
              metadata: {
                agentId: attempt.lineage.agentId,
                executionId: attempt.lineage.executionId,
                correlationId: attempt.lineage.correlationId,
                requestId: attempt.lineage.requestId,
              },
            }),
          occurredAt: row.createdAt,
          costMicros:
            attempt.cost.status === 'CALCULATED'
              ? BigInt(attempt.cost.totalCostMicros ?? '0')
              : null,
          kind: 'ACTUAL',
          pricingStatus: attempt.cost.status,
        });
      }
    } else {
      for (const reservation of evidence.reservations) {
        if (reservation.status !== 'RECONCILED') {
          continue;
        }

        entries.push({
          context: reservation.context,
          occurredAt: new Date(
            reservation.reconciledAt ?? reservation.reservedAt,
          ),
          costMicros:
            reservation.actualCostMicros === null
              ? null
              : BigInt(reservation.actualCostMicros),
          kind: 'ACTUAL',
          pricingStatus:
            reservation.actualCostMicros === null ? 'UNPRICED' : 'CALCULATED',
        });
      }
    }

    for (const reservation of evidence.reservations) {
      if (
        reservation.status !== 'RESERVED' ||
        accountedReservationKeys.has(
          this.createReservationAttemptKey(reservation),
        )
      ) {
        continue;
      }

      entries.push({
        context: reservation.context,
        occurredAt: new Date(reservation.reservedAt),
        costMicros:
          reservation.estimatedCostMicros === null
            ? null
            : BigInt(reservation.estimatedCostMicros),
        kind: 'ACTIVE_RESERVATION',
        pricingStatus:
          reservation.estimatedCostMicros === null ? 'UNPRICED' : 'CALCULATED',
      });
    }

    return entries.filter((entry) => !Number.isNaN(entry.occurredAt.getTime()));
  }

  private matchesReservationAttempt(
    reservation: AiBudgetReservationEvidence,
    attempt: AiProviderCostAccountingAttempt,
  ): boolean {
    const compatibleKind =
      reservation.attemptKind === attempt.kind ||
      (reservation.attemptKind === 'EMBEDDING' && attempt.kind === 'PRIMARY');

    return (
      reservation.providerAttemptId === attempt.attemptId ||
      (reservation.attemptSequence === attempt.sequence &&
        compatibleKind &&
        reservation.context.provider === attempt.provider &&
        reservation.context.model === attempt.model)
    );
  }

  private createReservationAttemptKey(
    reservation: AiBudgetReservationEvidence,
  ): string {
    return [
      reservation.attemptSequence,
      reservation.attemptKind,
      reservation.context.provider ?? '',
      reservation.context.model ?? '',
    ].join(':');
  }

  private parseAccountingSummary(
    value: unknown,
  ): AiProviderCostAccountingSummary | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const candidate = value as Partial<AiProviderCostAccountingSummary>;

    if (
      candidate.accountingVersion !== AI_PROVIDER_COST_ACCOUNTING_VERSION ||
      !Array.isArray(candidate.attempts)
    ) {
      return null;
    }

    return candidate as AiProviderCostAccountingSummary;
  }

  private resolveEarliestWindowStart(
    policies: readonly AiBudgetPolicyRecord[],
    now: Date,
  ): Date {
    return policies.reduce((earliest, policy) => {
      const start = AiBudgetPolicyUtil.resolveWindowRange(
        policy.window,
        now,
      ).start;

      return start < earliest ? start : earliest;
    }, new Date(now));
  }

  private async acquirePolicyLocks(
    tx: Prisma.TransactionClient,
    policies: readonly AiBudgetPolicyRecord[],
    now: Date,
  ): Promise<void> {
    const lockKeys = policies
      .map((policy) => {
        const windowStart = AiBudgetPolicyUtil.resolveWindowRange(
          policy.window,
          now,
        ).start.toISOString();

        return `vexo:ai-budget:${policy.id}:${windowStart}`;
      })
      .sort((left, right) => left.localeCompare(right));

    for (const lockKey of lockKeys) {
      await tx.$queryRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)
        `,
      );
    }
  }

  private async acquireReservationPolicyLocks(
    tx: Prisma.TransactionClient,
    decisions: readonly AiBudgetPolicyDecisionEvidence[],
  ): Promise<void> {
    const lockKeys = decisions
      .map(
        (decision) =>
          `vexo:ai-budget:${decision.policyId}:${decision.windowStart}`,
      )
      .sort((left, right) => left.localeCompare(right));

    for (const lockKey of lockKeys) {
      await tx.$queryRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)
        `,
      );
    }
  }

  private createReservationId(
    input: ReserveAiBudgetInput,
    context: AiBudgetExecutionContext,
  ): string {
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          version: AI_BUDGET_ENFORCEMENT_VERSION,
          runLogId: context.runLogId,
          executionId: context.executionId,
          correlationId: context.correlationId,
          requestId: context.requestId,
          attemptSequence: input.attemptSequence,
          attemptKind: input.attemptKind,
          provider: context.provider,
          model: context.model,
          taskType: context.taskType,
        }),
      )
      .digest('hex')
      .slice(0, 32);

    return `ai-budget-reservation-${digest}`;
  }

  private createDecisionId(
    reservationId: string,
    decision: AiBudgetDecision,
  ): string {
    return `ai-budget-decision-${createHash('sha256')
      .update(`${reservationId}:${decision}`)
      .digest('hex')
      .slice(0, 32)}`;
  }

  private createBlockException(
    decisions: readonly AiBudgetPolicyDecisionEvidence[],
  ): AiBudgetEnforcementException {
    const unknownPricingBlocked = decisions.some(
      (decision) =>
        decision.decision === 'BLOCK' &&
        decision.pricingStatus === 'UNPRICED' &&
        decision.unknownPricingMode === 'BLOCK',
    );

    return new AiBudgetEnforcementException(
      unknownPricingBlocked ? 'UNKNOWN_PRICING_BLOCKED' : 'HARD_LIMIT_EXCEEDED',
      unknownPricingBlocked
        ? 'هزینه این Provider یا مدل قیمت‌گذاری نشده و سیاست بودجه اجرای آن را مسدود کرده است.'
        : 'سقف سخت بودجه هوش مصنوعی اجازه اجرای این درخواست را نمی‌دهد.',
      {
        policyDecisions: decisions,
      },
    );
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
