import { ForbiddenException } from '@nestjs/common';

export type AiBudgetEnforcementFailureReason =
  | 'HARD_LIMIT_EXCEEDED'
  | 'UNKNOWN_PRICING_BLOCKED'
  | 'RUN_LOG_REQUIRED'
  | 'POLICY_INVALID'
  | 'ENFORCEMENT_UNAVAILABLE';

export class AiBudgetEnforcementException extends ForbiddenException {
  readonly budgetEnforcement = true;

  readonly code = 'AI_BUDGET_ENFORCEMENT_BLOCKED';

  constructor(
    readonly reason: AiBudgetEnforcementFailureReason,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super({
      statusCode: 403,
      error: 'AI_BUDGET_ENFORCEMENT_BLOCKED',
      message,
      reason,
      details,
    });
  }

  static isBudgetEnforcementException(
    error: unknown,
  ): error is AiBudgetEnforcementException {
    if (error instanceof AiBudgetEnforcementException) {
      return true;
    }

    if (!error || typeof error !== 'object') {
      return false;
    }

    return (
      (error as { budgetEnforcement?: unknown }).budgetEnforcement === true ||
      (error as { code?: unknown }).code === 'AI_BUDGET_ENFORCEMENT_BLOCKED'
    );
  }
}
