import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppExceptionOptions {
  readonly statusCode?: HttpStatus;
  readonly message: string;
  readonly error?: string;
  readonly code?: string;
  readonly details?: unknown;
}

export interface AppExceptionResponse {
  readonly success: false;
  readonly statusCode: HttpStatus;
  readonly message: string;
  readonly error: string;
  readonly code?: string;
  readonly details?: unknown;
}

export class AppException extends HttpException {
  readonly code?: string;
  readonly details?: unknown;

  constructor(options: AppExceptionOptions) {
    const statusCode = AppException.normalizeStatusCode(options.statusCode);
    const message = AppException.normalizeMessage(options.message);
    const error = AppException.normalizeError(options.error, statusCode);
    const code = AppException.normalizeOptionalString(options.code);
    const response = AppException.createResponse({
      statusCode,
      message,
      error,
      code,
      details: options.details,
    });

    super(response, statusCode);

    this.code = code;
    this.details = options.details;
  }

  private static createResponse(
    options: AppExceptionOptions & {
      readonly statusCode: HttpStatus;
      readonly error: string;
    },
  ): AppExceptionResponse {
    const response: {
      success: false;
      statusCode: HttpStatus;
      message: string;
      error: string;
      code?: string;
      details?: unknown;
    } = {
      success: false,
      statusCode: options.statusCode,
      message: options.message,
      error: options.error,
    };

    const code = this.normalizeOptionalString(options.code);

    if (code) {
      response.code = code;
    }

    if (options.details !== undefined) {
      response.details = options.details;
    }

    return response;
  }

  private static normalizeStatusCode(statusCode?: HttpStatus): HttpStatus {
    if (
      typeof statusCode === 'number' &&
      Number.isInteger(statusCode) &&
      Number(statusCode) >= 400 &&
      Number(statusCode) <= 599
    ) {
      return statusCode;
    }

    return HttpStatus.BAD_REQUEST;
  }

  private static normalizeMessage(message: string): string {
    const normalizedMessage = message.trim();

    return normalizedMessage.length > 0
      ? normalizedMessage
      : 'درخواست معتبر نیست.';
  }

  private static normalizeError(
    error: string | undefined,
    statusCode: HttpStatus,
  ): string {
    const normalizedError = this.normalizeOptionalString(error);

    if (normalizedError) {
      return normalizedError;
    }

    const statusName = HttpStatus[statusCode];

    return typeof statusName === 'string' && statusName.trim().length > 0
      ? statusName
      : 'Error';
  }

  private static normalizeOptionalString(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
