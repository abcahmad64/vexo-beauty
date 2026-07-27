import { HttpStatus } from '@nestjs/common';

import { AppException } from './app.exception';

export class BusinessException extends AppException {
  constructor(
    message = 'خطای تجاری رخ داده است.',
    code = 'BUSINESS_ERROR',
    details?: unknown,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Business Error',
      code,
      details,
    });
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(
    message = 'اطلاعات موردنظر یافت نشد.',
    code = 'RESOURCE_NOT_FOUND',
    details?: unknown,
  ) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      message,
      error: 'Not Found',
      code,
      details,
    });
  }
}

export class ResourceConflictException extends AppException {
  constructor(
    message = 'این اطلاعات قبلاً ثبت شده است.',
    code = 'RESOURCE_CONFLICT',
    details?: unknown,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      message,
      error: 'Conflict',
      code,
      details,
    });
  }
}

export class AccessDeniedException extends AppException {
  constructor(
    message = 'شما مجوز انجام این عملیات را ندارید.',
    code = 'ACCESS_DENIED',
    details?: unknown,
  ) {
    super({
      statusCode: HttpStatus.FORBIDDEN,
      message,
      error: 'Forbidden',
      code,
      details,
    });
  }
}

export class InvalidOperationException extends AppException {
  constructor(
    message = 'عملیات درخواستی معتبر نیست.',
    code = 'INVALID_OPERATION',
    details?: unknown,
  ) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Invalid Operation',
      code,
      details,
    });
  }
}
