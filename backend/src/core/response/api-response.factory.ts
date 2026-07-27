import type { ApiResponse, ApiResponseMeta } from './api-response.interface';

export class ApiResponseFactory {
  static success<T>(
    data: T | null,
    message = 'عملیات با موفقیت انجام شد.',
    meta?: ApiResponseMeta,
  ): ApiResponse<T> {
    const response: {
      success: true;
      message: string;
      data: T | null;
      meta?: ApiResponseMeta;
    } = {
      success: true,
      message: this.normalizeMessage(message, 'عملیات با موفقیت انجام شد.'),
      data: data ?? null,
    };

    const normalizedMeta = this.normalizeMeta(meta);

    if (normalizedMeta) {
      response.meta = normalizedMeta;
    }

    return response;
  }

  static error(
    message = 'درخواست با خطا مواجه شد.',
    meta?: ApiResponseMeta,
  ): ApiResponse<null> {
    const response: {
      success: false;
      message: string;
      data: null;
      meta?: ApiResponseMeta;
    } = {
      success: false,
      message: this.normalizeMessage(message, 'درخواست با خطا مواجه شد.'),
      data: null,
    };

    const normalizedMeta = this.normalizeMeta(meta);

    if (normalizedMeta) {
      response.meta = normalizedMeta;
    }

    return response;
  }

  private static normalizeMessage(message: string, fallback: string): string {
    const normalizedMessage = message.trim();

    return normalizedMessage.length > 0 ? normalizedMessage : fallback;
  }

  private static normalizeMeta(
    meta: ApiResponseMeta | undefined,
  ): ApiResponseMeta | undefined {
    if (!meta || typeof meta !== 'object') {
      return undefined;
    }

    return meta;
  }
}
