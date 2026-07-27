import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AnalyticsEventType } from './analytics.event.types';

import {
  AnalyticsDashboardViewedPayload,
  AnalyticsEventRecordedPayload,
  AnalyticsMetricRecordedPayload,
  AnalyticsReportViewedPayload,
} from './analytics.event.payloads';

@Injectable()
export class AnalyticsEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishAnalyticsEventRecorded(payload: AnalyticsEventRecordedPayload): void {
    this.eventEmitter.emit(
      AnalyticsEventType.ANALYTICS_EVENT_RECORDED,
      payload,
    );
  }

  publishAnalyticsMetricRecorded(
    payload: AnalyticsMetricRecordedPayload,
  ): void {
    this.eventEmitter.emit(
      AnalyticsEventType.ANALYTICS_METRIC_RECORDED,
      payload,
    );
  }

  publishDashboardViewed(payload: AnalyticsDashboardViewedPayload): void {
    this.eventEmitter.emit(
      AnalyticsEventType.ANALYTICS_DASHBOARD_VIEWED,
      payload,
    );
  }

  publishReportViewed(payload: AnalyticsReportViewedPayload): void {
    this.eventEmitter.emit(AnalyticsEventType.ANALYTICS_REPORT_VIEWED, payload);
  }
}
