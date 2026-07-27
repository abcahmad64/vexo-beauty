import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AdminEventType } from './admin.event.types';

import {
  AdminActivityViewedEventPayload,
  AdminDashboardViewedEventPayload,
  AdminHealthCheckedEventPayload,
  AdminOverviewViewedEventPayload,
} from './admin.event.payloads';

@Injectable()
export class AdminEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishDashboardViewed(payload: AdminDashboardViewedEventPayload): void {
    this.eventEmitter.emit(AdminEventType.ADMIN_DASHBOARD_VIEWED, payload);
  }

  publishOverviewViewed(payload: AdminOverviewViewedEventPayload): void {
    this.eventEmitter.emit(AdminEventType.ADMIN_OVERVIEW_VIEWED, payload);
  }

  publishActivityViewed(payload: AdminActivityViewedEventPayload): void {
    this.eventEmitter.emit(AdminEventType.ADMIN_ACTIVITY_VIEWED, payload);
  }

  publishHealthChecked(payload: AdminHealthCheckedEventPayload): void {
    this.eventEmitter.emit(AdminEventType.ADMIN_HEALTH_CHECKED, payload);
  }
}
