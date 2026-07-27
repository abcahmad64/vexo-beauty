export type SearchFilters = Record<string, unknown>;

export interface SearchPerformedEventPayload {
  query?: string | null;
  scope:
    | 'products'
    | 'categories'
    | 'brands'
    | 'global'
    | 'admin_products'
    | 'admin_global';
  filters?: SearchFilters;
  resultCount: number;
  userId?: string;
  actorId?: string;
  occurredAt: Date;
}

export interface SearchSuggestionsGeneratedEventPayload {
  query: string;
  resultCount: number;
  userId?: string;
  actorId?: string;
  occurredAt: Date;
}
