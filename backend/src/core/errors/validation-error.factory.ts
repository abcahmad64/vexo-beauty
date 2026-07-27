import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { ErrorCode } from './error-code.enum';

export interface ValidationErrorResponse {
  readonly message: string;
  readonly code: ErrorCode.VALIDATION_ERROR;
  readonly details: readonly string[];
}

export function validationErrorFactory(
  errors: readonly ValidationError[],
): BadRequestException {
  const details = flattenValidationErrors(errors);

  const response: ValidationErrorResponse = {
    message: 'اطلاعات ارسال‌شده معتبر نیست.',
    code: ErrorCode.VALIDATION_ERROR,
    details:
      details.length > 0
        ? details
        : ['اطلاعات ارسال‌شده با قواعد اعتبارسنجی سازگار نیست.'],
  };

  return new BadRequestException(response);
}

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parent = '',
): readonly string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = buildValidationPath(parent, error.property);

    if (error.constraints) {
      messages.push(...extractConstraintMessages(error.constraints, path));
    }

    if (Array.isArray(error.children) && error.children.length > 0) {
      messages.push(...flattenValidationErrors(error.children, path));
    }
  }

  return Array.from(new Set(messages));
}

function extractConstraintMessages(
  constraints: Readonly<Record<string, string>>,
  path: string,
): readonly string[] {
  return Object.values(constraints)
    .filter((message): message is string => {
      return typeof message === 'string' && message.trim().length > 0;
    })
    .map((message) => {
      const normalizedMessage = message.trim();

      return path ? `${path}: ${normalizedMessage}` : normalizedMessage;
    });
}

function buildValidationPath(parent: string, property: string): string {
  const normalizedParent = parent.trim();
  const normalizedProperty = property.trim();

  if (normalizedParent && normalizedProperty) {
    return `${normalizedParent}.${normalizedProperty}`;
  }

  return normalizedParent || normalizedProperty;
}
