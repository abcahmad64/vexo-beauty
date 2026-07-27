import type { QueueJobResult, QueuePayload } from '../types/queue.types';

export class QueueResultUtil {
  static success(message: string, details?: QueuePayload): QueueJobResult {
    return this.createResult(true, message, details);
  }

  static failed(message: string, details?: QueuePayload): QueueJobResult {
    return this.createResult(false, message, details);
  }

  private static createResult(
    success: boolean,
    message: string,
    details?: QueuePayload,
  ): QueueJobResult {
    const result: {
      success: boolean;
      message: string;
      processedAt: string;
      details?: QueuePayload;
    } = {
      success,
      message: this.normalizeMessage(message),
      processedAt: new Date().toISOString(),
    };

    const normalizedDetails = this.normalizeDetails(details);

    if (normalizedDetails) {
      result.details = normalizedDetails;
    }

    return result;
  }

  private static normalizeMessage(message: string): string {
    const normalizedMessage = message.trim();

    return normalizedMessage.length > 0
      ? normalizedMessage
      : 'نتیجه پردازش Job ثبت شد.';
  }

  private static normalizeDetails(
    details: QueuePayload | undefined,
  ): QueuePayload | undefined {
    if (
      details &&
      typeof details === 'object' &&
      !Array.isArray(details) &&
      Object.keys(details).length > 0
    ) {
      return details;
    }

    return undefined;
  }
}
