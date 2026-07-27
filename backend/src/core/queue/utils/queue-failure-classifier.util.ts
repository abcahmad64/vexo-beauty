import { HttpException, HttpStatus } from '@nestjs/common';

import { QUEUE_FAILURE_TAXONOMY_VERSION } from '../types/queue.types';

import type {
  QueueFailureCategory,
  QueueFailureClassification,
  QueueFailureSeverity,
} from '../types/queue.types';

import { QueueErrorUtil } from './queue-error.util';

interface QueueFailureRule {
  readonly category: QueueFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly severity: QueueFailureSeverity;
}

interface ErrorWithCode {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly statusCode?: unknown;
}

export class QueueFailureClassifierUtil {
  static classify(error: unknown): QueueFailureClassification {
    const message = QueueErrorUtil.resolveMessage(error);
    const statusCode = this.resolveStatusCode(error);
    const errorCode = this.resolveErrorCode(error);
    const rule = this.resolveRule(message, statusCode, errorCode);

    return {
      version: QUEUE_FAILURE_TAXONOMY_VERSION,
      category: rule.category,
      code: rule.code,
      retryable: rule.retryable,
      severity: rule.severity,
      message: message.slice(0, 2_000),
      ...(statusCode !== undefined
        ? {
            statusCode,
          }
        : {}),
      classifiedAt: new Date().toISOString(),
    };
  }

  static getSnapshot() {
    return {
      version: QUEUE_FAILURE_TAXONOMY_VERSION,
      categories: [
        'VALIDATION',
        'AUTHORIZATION',
        'NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT',
        'TIMEOUT',
        'DEPENDENCY_UNAVAILABLE',
        'TRANSIENT_NETWORK',
        'CIRCUIT_OPEN',
        'PERMANENT',
        'UNKNOWN',
      ] as const,
      retryPolicy: {
        retryableCategories: [
          'RATE_LIMIT',
          'TIMEOUT',
          'DEPENDENCY_UNAVAILABLE',
          'TRANSIENT_NETWORK',
          'CIRCUIT_OPEN',
          'UNKNOWN',
        ] as const,
        nonRetryableCategories: [
          'VALIDATION',
          'AUTHORIZATION',
          'NOT_FOUND',
          'CONFLICT',
          'PERMANENT',
        ] as const,
      },
      deadLetterPropagation: true,
      safeMessageLimit: 2_000,
    };
  }

  private static resolveRule(
    message: string,
    statusCode?: number,
    errorCode?: string,
  ): QueueFailureRule {
    const normalizedMessage = message.toLowerCase();

    if (
      normalizedMessage.includes('مدار حفاظتی') ||
      normalizedMessage.includes('circuit breaker') ||
      normalizedMessage.includes('circuit is open')
    ) {
      return this.rule('CIRCUIT_OPEN', 'AI_CIRCUIT_OPEN', true, 'WARNING');
    }

    if (
      errorCode &&
      [
        'ETIMEDOUT',
        'ESOCKETTIMEDOUT',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT',
      ].includes(errorCode)
    ) {
      return this.rule('TIMEOUT', errorCode, true, 'WARNING');
    }

    if (
      errorCode &&
      [
        'ECONNRESET',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'EAI_AGAIN',
        'ENOTFOUND',
      ].includes(errorCode)
    ) {
      return this.rule('TRANSIENT_NETWORK', errorCode, true, 'WARNING');
    }

    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return this.rule(
          'VALIDATION',
          'HTTP_VALIDATION_ERROR',
          false,
          'WARNING',
        );
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        return this.rule(
          'AUTHORIZATION',
          'HTTP_AUTHORIZATION_ERROR',
          false,
          'ERROR',
        );
      case HttpStatus.NOT_FOUND:
        return this.rule('NOT_FOUND', 'HTTP_NOT_FOUND', false, 'WARNING');
      case HttpStatus.CONFLICT:
        return this.rule('CONFLICT', 'HTTP_CONFLICT', false, 'WARNING');
      case HttpStatus.TOO_MANY_REQUESTS:
        return this.rule('RATE_LIMIT', 'HTTP_RATE_LIMIT', true, 'WARNING');
      case HttpStatus.REQUEST_TIMEOUT:
      case HttpStatus.GATEWAY_TIMEOUT:
        return this.rule('TIMEOUT', 'HTTP_TIMEOUT', true, 'WARNING');
      case HttpStatus.BAD_GATEWAY:
      case HttpStatus.SERVICE_UNAVAILABLE:
        return this.rule(
          'DEPENDENCY_UNAVAILABLE',
          'HTTP_DEPENDENCY_UNAVAILABLE',
          true,
          'ERROR',
        );
      default:
        break;
    }

    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return this.rule('PERMANENT', 'HTTP_PERMANENT_ERROR', false, 'ERROR');
    }

    if (
      normalizedMessage.includes('timeout') ||
      normalizedMessage.includes('timed out') ||
      normalizedMessage.includes('مهلت')
    ) {
      return this.rule('TIMEOUT', 'MESSAGE_TIMEOUT', true, 'WARNING');
    }

    return this.rule(
      'UNKNOWN',
      errorCode ?? 'QUEUE_UNKNOWN_FAILURE',
      true,
      'ERROR',
    );
  }

  private static rule(
    category: QueueFailureCategory,
    code: string,
    retryable: boolean,
    severity: QueueFailureSeverity,
  ): QueueFailureRule {
    return {
      category,
      code,
      retryable,
      severity,
    };
  }

  private static resolveStatusCode(error: unknown): number | undefined {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const candidate = error as ErrorWithCode;

    return (
      this.normalizeStatusCode(candidate.statusCode) ??
      this.normalizeStatusCode(candidate.status)
    );
  }

  private static normalizeStatusCode(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return undefined;
    }

    return value >= 100 && value <= 599 ? value : undefined;
  }

  private static resolveErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const code = (error as ErrorWithCode).code;

    if (typeof code !== 'string') {
      return undefined;
    }

    const normalized = code.trim().toUpperCase();

    return normalized.length > 0 ? normalized.slice(0, 100) : undefined;
  }
}
