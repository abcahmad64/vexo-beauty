export interface CacheInvalidationOptions {
  readonly key?: string | null;
  readonly keys?: readonly string[] | null;
  readonly pattern?: string | null;
  readonly namespace?: string | null;
  readonly tag?: string | null;
  readonly tags?: readonly string[] | null;
  readonly flush?: boolean;
  readonly actorId?: string | null;
}

export interface CacheInvalidationResult {
  readonly invalidated: boolean;
  readonly actions: readonly string[];
  readonly actorId: string | null;
  readonly occurredAt: Date;
}
