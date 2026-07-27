import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { AdminEventType } from './admin.event.types';

import {
  AdminActivityViewedEventPayload,
  AdminDashboardViewedEventPayload,
  AdminHealthCheckedEventPayload,
  AdminOverviewViewedEventPayload,
} from './admin.event.payloads';

@Injectable()
export class AdminEventHandler {
  private readonly logger = new Logger(AdminEventHandler.name);

  @OnEvent(AdminEventType.ADMIN_DASHBOARD_VIEWED)
  handleDashboardViewed(payload: AdminDashboardViewedEventPayload): void {
    this.logger.log(`Admin dashboard viewed by ${payload.actorId}`);
  }

  @OnEvent(AdminEventType.ADMIN_OVERVIEW_VIEWED)
  handleOverviewViewed(payload: AdminOverviewViewedEventPayload): void {
    this.logger.log(`Admin overview viewed by ${payload.actorId}`);
  }

  @OnEvent(AdminEventType.ADMIN_ACTIVITY_VIEWED)
  handleActivityViewed(payload: AdminActivityViewedEventPayload): void {
    this.logger.log(
      `Admin activity viewed by ${payload.actorId}; source=${payload.source ?? 'all'}`,
    );
  }

  @OnEvent(AdminEventType.ADMIN_HEALTH_CHECKED)
  handleHealthChecked(payload: AdminHealthCheckedEventPayload): void {
    this.logger.log(
      `Admin health checked by ${payload.actorId}; status=${payload.status}`,
    );
  }
}
