import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { QueueFailureClassifierUtil } from './queue-failure-classifier.util';

describe('QueueFailureClassifierUtil', () => {
  it('classifies validation errors as permanent and non-retryable', () => {
    const result = QueueFailureClassifierUtil.classify(
      new BadRequestException('payload is invalid'),
    );

    expect(result).toMatchObject({
      version: '1.0.0',
      category: 'VALIDATION',
      code: 'HTTP_VALIDATION_ERROR',
      retryable: false,
      severity: 'WARNING',
      statusCode: 400,
    });
  });

  it('classifies open AI circuits as retryable circuit failures', () => {
    const result = QueueFailureClassifierUtil.classify(
      new ServiceUnavailableException(
        'مدار حفاظتی سرویس هوش مصنوعی برای primary-model موقتاً باز است.',
      ),
    );

    expect(result).toMatchObject({
      category: 'CIRCUIT_OPEN',
      code: 'AI_CIRCUIT_OPEN',
      retryable: true,
      severity: 'WARNING',
      statusCode: 503,
    });
  });

  it('classifies network timeouts without exposing unsafe fields', () => {
    const error = Object.assign(new Error('upstream request timed out'), {
      code: 'ETIMEDOUT',
    });

    const result = QueueFailureClassifierUtil.classify(error);

    expect(result).toMatchObject({
      category: 'TIMEOUT',
      code: 'ETIMEDOUT',
      retryable: true,
      severity: 'WARNING',
    });
    expect(result.message).toBe('upstream request timed out');
  });
});
