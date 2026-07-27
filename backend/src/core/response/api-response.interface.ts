export interface ApiResponseMeta {
  readonly path?: string;
  readonly method?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly durationMs?: number;
  readonly timestamp: string;
  readonly timestampFa?: string | null;
  readonly pagination?: unknown;
}

export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly message: string;
  readonly data: T | null;
  readonly meta?: ApiResponseMeta;
}
