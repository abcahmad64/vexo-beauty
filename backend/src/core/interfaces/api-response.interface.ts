export type {
  ApiResponse,
  ApiResponseMeta,
} from '../response/api-response.interface';

export interface ApiErrorResponse {
  readonly success: false;
  readonly statusCode: number;
  readonly message: string;
  readonly error: string;
  readonly code?: string;
  readonly details?: unknown;
  readonly path?: string;
  readonly method?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly timestampFa?: string | null;
}
