import {
  REDACTED_VALUE,
  SENSITIVE_LOG_FIELDS,
} from '../constants/logging.constants';

export class LogSanitizerUtil {
  private static readonly maxDepth = 8;

  private static readonly exactSensitiveKeys = new Set(
    SENSITIVE_LOG_FIELDS.map((field) => LogSanitizerUtil.normalizeKey(field)),
  );

  private static readonly partialSensitiveKeys = new Set([
    'password',
    'token',
    'authorization',
    'cookie',
    'secret',
    'apikey',
    'accesskey',
    'privatekey',
    'jwt',
    'session',
    'otp',
    'verification',
    'phone',
    'mobile',
    'email',
    'nationalcode',
    'cardnumber',
    'iban',
    'sheba',
  ]);

  static sanitize(value: unknown): unknown {
    return this.sanitizeInternal(value, 0, new WeakSet<object>());
  }

  private static sanitizeInternal(
    value: unknown,
    depth: number,
    seen: WeakSet<object>,
  ): unknown {
    if (value === undefined) {
      return undefined;
    }

    if (depth > this.maxDepth) {
      return '[MAX_DEPTH_REACHED]';
    }

    if (value === null) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    if (typeof value === 'function') {
      return '[FUNCTION]';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeInternal(item, depth + 1, seen));
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[CIRCULAR]';
      }

      seen.add(value);

      const sanitizedRecord: Record<string, unknown> = {};
      const record = value as Record<string, unknown>;

      for (const [key, item] of Object.entries(record)) {
        if (this.isSensitiveKey(key)) {
          sanitizedRecord[key] = REDACTED_VALUE;
          continue;
        }

        const sanitizedValue = this.sanitizeInternal(item, depth + 1, seen);

        if (sanitizedValue !== undefined) {
          sanitizedRecord[key] = sanitizedValue;
        }
      }

      seen.delete(value);

      return sanitizedRecord;
    }

    return value;
  }

  private static isSensitiveKey(key: string): boolean {
    const normalizedKey = this.normalizeKey(key);

    if (normalizedKey.length === 0) {
      return false;
    }

    if (this.exactSensitiveKeys.has(normalizedKey)) {
      return true;
    }

    return [...this.partialSensitiveKeys].some((field) =>
      normalizedKey.includes(field),
    );
  }

  private static normalizeKey(key: string): string {
    return key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/gu, '');
  }
}
