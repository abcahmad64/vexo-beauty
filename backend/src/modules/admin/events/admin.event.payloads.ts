export interface AdminBaseEventPayload {
  actorId: string;
  occurredAt: Date;
}

export interface AdminDashboardViewedEventPayload extends AdminBaseEventPayload {
  createdFrom?: string;
  createdTo?: string;
  currency?: string;
}

export interface AdminOverviewViewedEventPayload extends AdminBaseEventPayload {
  createdFrom?: string;
  createdTo?: string;
  currency?: string;
}

export interface AdminActivityViewedEventPayload extends AdminBaseEventPayload {
  source?: string;
  page: number;
  limit: number;
}

export interface AdminHealthCheckedEventPayload extends AdminBaseEventPayload {
  status: 'healthy' | 'warning' | 'critical';
}
