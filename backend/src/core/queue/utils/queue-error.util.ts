export class QueueErrorUtil {
  static resolveMessage(error: unknown): string {
    if (error instanceof Error) {
      return this.normalizeString(error.message) ?? this.getDefaultMessage();
    }

    if (typeof error === 'string') {
      return this.normalizeString(error) ?? this.getDefaultMessage();
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const value = (error as { readonly message?: unknown }).message;

      if (typeof value === 'string') {
        return this.normalizeString(value) ?? this.getDefaultMessage();
      }
    }

    return this.getDefaultMessage();
  }

  static resolveStack(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }

    return this.normalizeString(error.stack);
  }

  static toSafeRecord(value: unknown): Record<string, unknown> {
    if (value instanceof Error) {
      return this.errorToRecord(value);
    }

    if (this.isPlainRecord(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return {
        value,
      };
    }

    if (value === undefined) {
      return {};
    }

    return {
      value,
    };
  }

  static errorToRecord(error: Error): Record<string, unknown> {
    const record: Record<string, unknown> = {
      name: this.normalizeString(error.name) ?? 'Error',
      message: this.resolveMessage(error),
    };

    const errorWithOptionalFields = error as Error & {
      readonly code?: unknown;
      readonly status?: unknown;
      readonly statusCode?: unknown;
      readonly cause?: unknown;
    };

    const stack = this.resolveStack(error);

    if (stack) {
      record.stack = stack;
    }

    if (errorWithOptionalFields.code !== undefined) {
      record.code = errorWithOptionalFields.code;
    }

    if (errorWithOptionalFields.status !== undefined) {
      record.status = errorWithOptionalFields.status;
    }

    if (errorWithOptionalFields.statusCode !== undefined) {
      record.statusCode = errorWithOptionalFields.statusCode;
    }

    if (errorWithOptionalFields.cause !== undefined) {
      record.cause = this.toSafeRecord(errorWithOptionalFields.cause);
    }

    return record;
  }

  private static isPlainRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static normalizeString(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  private static getDefaultMessage(): string {
    return 'خطای ناشناخته در پردازش Job رخ داد.';
  }
}
