import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { AnalyticsEventType } from './analytics.event.types';

import {
  AnalyticsDashboardViewedPayload,
  AnalyticsEventRecordedPayload,
  AnalyticsMetricRecordedPayload,
  AnalyticsReportViewedPayload,
} from './analytics.event.payloads';

@Injectable()
export class AnalyticsEventHandler {
  private readonly logger = new Logger(AnalyticsEventHandler.name);

  @OnEvent(AnalyticsEventType.ANALYTICS_EVENT_RECORDED)
  handleAnalyticsEventRecorded(payload: AnalyticsEventRecordedPayload): void {
    this.logger.log(
      `Analytics event recorded: ${payload.name}; id=${payload.eventId}`,
    );
  }

  @OnEvent(AnalyticsEventType.ANALYTICS_METRIC_RECORDED)
  handleAnalyticsMetricRecorded(payload: AnalyticsMetricRecordedPayload): void {
    this.logger.log(
      `Analytics metric recorded: ${payload.name}; value=${payload.value}`,
    );
  }

  @OnEvent(AnalyticsEventType.ANALYTICS_DASHBOARD_VIEWED)
  handleDashboardViewed(payload: AnalyticsDashboardViewedPayload): void {
    this.logger.log(`Analytics dashboard viewed by ${payload.actorId}`);
  }

  @OnEvent(AnalyticsEventType.ANALYTICS_REPORT_VIEWED)
  handleReportViewed(payload: AnalyticsReportViewedPayload): void {
    this.logger.log(
      `Analytics report viewed: ${payload.report}; actor=${payload.actorId}`,
    );
  }
}
