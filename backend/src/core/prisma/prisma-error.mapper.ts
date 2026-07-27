import { HttpStatus } from '@nestjs/common';

import { DEFAULT_API_MESSAGES } from '../constants/core.constants';
import { ErrorCode } from '../errors/error-code.enum';
import { safeJson } from '../utils/safe-json.util';

export interface PrismaErrorLike {
  readonly code?: string;
  readonly meta?: unknown;
  readonly message?: string;
  readonly clientVersion?: string;
}

export interface MappedPrismaError {
  readonly statusCode: number;
  readonly message: string;
  readonly error: string;
  readonly code: string;
  readonly details?: unknown;
}

export function isPrismaError(error: unknown): error is PrismaErrorLike {
  if (!isRecord(error)) {
    return false;
  }

  return typeof error.code === 'string' && /^P\d{4}$/u.test(error.code);
}

export function mapPrismaError(error: unknown): MappedPrismaError | null {
  if (!isPrismaError(error)) {
    return null;
  }

  const code = normalizePrismaCode(error.code);
  const details = normalizePrismaDetails(error);

  switch (code) {
    case 'P1000':
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'احراز هویت اتصال به دیتابیس ناموفق بود.',
        error: 'Database Authentication Failed',
        code,
        details,
      };

    case 'P1001':
    case 'P1002':
    case 'P1017':
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'اتصال به دیتابیس در حال حاضر برقرار نیست.',
        error: 'Database Connection Error',
        code,
        details,
      };

    case 'P2000':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'مقدار یکی از فیلدها بیش از حد مجاز است.',
        error: 'Bad Request',
        code,
        details,
      };

    case 'P2001':
    case 'P2015':
    case 'P2018':
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: DEFAULT_API_MESSAGES.NOT_FOUND,
        error: 'Not Found',
        code,
        details,
      };

    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        message: DEFAULT_API_MESSAGES.CONFLICT,
        error: 'Conflict',
        code,
        details,
      };

    case 'P2003':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'ارتباط اطلاعات ارسال‌شده با داده‌های موجود معتبر نیست.',
        error: 'Foreign Key Constraint Failed',
        code,
        details,
      };

    case 'P2004':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'محدودیت دیتابیس اجازه انجام این عملیات را نمی‌دهد.',
        error: 'Database Constraint Failed',
        code,
        details,
      };

    case 'P2011':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'یکی از فیلدهای ضروری ارسال نشده است.',
        error: 'Null Constraint Violation',
        code,
        details,
      };

    case 'P2014':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'این عملیات باعث ایجاد ارتباط نامعتبر بین داده‌ها می‌شود.',
        error: 'Invalid Relation',
        code,
        details,
      };

    case 'P2024':
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'اتصال به دیتابیس در زمان مجاز انجام نشد.',
        error: 'Database Timeout',
        code,
        details,
      };

    case 'P2028':
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'تراکنش دیتابیس کامل نشد. لطفاً دوباره تلاش کنید.',
        error: 'Transaction Error',
        code,
        details,
      };

    case 'P2034':
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'به دلیل تداخل همزمانی، عملیات انجام نشد. دوباره تلاش کنید.',
        error: 'Transaction Conflict',
        code,
        details,
      };

    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: DEFAULT_API_MESSAGES.INTERNAL_ERROR,
        error: 'Database Error',
        code,
        details,
      };
  }
}

function normalizePrismaCode(code: string | undefined): string {
  if (typeof code === 'string' && /^P\d{4}$/u.test(code)) {
    return code;
  }

  return ErrorCode.DATABASE_ERROR;
}

function normalizePrismaDetails(error: PrismaErrorLike): unknown {
  const meta = safeJson(error.meta);

  if (!isRecord(meta)) {
    return meta;
  }

  const details: {
    readonly [key: string]: unknown;
    readonly target?: readonly string[];
    readonly clientVersion?: string;
  } = {
    ...meta,
  };

  const target = normalizePrismaTarget(meta.target);

  if (target) {
    return {
      ...details,
      target,
      clientVersion: normalizeOptionalString(error.clientVersion),
    };
  }

  return {
    ...details,
    clientVersion: normalizeOptionalString(error.clientVersion),
  };
}

function normalizePrismaTarget(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const fields = value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);

    return fields.length > 0 ? fields : undefined;
  }

  const normalizedValue = normalizeOptionalString(value);

  return normalizedValue ? [normalizedValue] : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
