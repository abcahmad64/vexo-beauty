export type AnalyticsMetadata = Record<string, unknown>;

export interface AnalyticsEventRecordedPayload {
  eventId: string;
  name: string;
  category?: string | null;
  userId?: string | null;
  data?: AnalyticsMetadata | null;
  actorId?: string;
  occurredAt: Date;
}

export interface AnalyticsMetricRecordedPayload {
  metricId: string;
  name: string;
  value: string;
  unit?: string | null;
  category?: string | null;
  actorId?: string;
  occurredAt: Date;
}

export interface AnalyticsDashboardViewedPayload {
  actorId: string;
  createdFrom?: string;
  createdTo?: string;
  occurredAt: Date;
}

export interface AnalyticsReportViewedPayload {
  report: string;
  actorId: string;
  createdFrom?: string;
  createdTo?: string;
  occurredAt: Date;
}
