import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { CoreSchedulerModule } from '../../core/scheduler/scheduler.module';

import { AiModule } from '../ai/ai.module';

import { NotificationModule } from '../notification/notification.module';

import { AdminController } from './admin.controller';

import { AdminActionCenterController } from './admin-action-center.controller';

import { AdminCommandCenterController } from './admin-command-center.controller';

import { AdminEnterpriseDashboardController } from './admin-enterprise-dashboard.controller';

import { AdminInsightController } from './admin-insight.controller';

import { AdminOperationsAlertController } from './admin-operations-alert.controller';

import { AdminOperationsAlertAnalyticsController } from './admin-operations-alert-analytics.controller';

import { AdminOperationsAlertEscalationController } from './admin-operations-alert-escalation.controller';

import { AdminOperationsDigestController } from './admin-operations-digest.controller';

import { AdminOperationsDigestNotificationController } from './admin-operations-digest-notification.controller';

import { AdminOperationsHealthController } from './admin-operations-health.controller';

import { AdminOperationsWatchdogController } from './admin-operations-watchdog.controller';

import { AdminScheduledOperationsDigestController } from './admin-scheduled-operations-digest.controller';

import { AdminTimelineController } from './admin-timeline.controller';

import { AdminEventHandler } from './events/admin.event.handler';

import { AdminEventPublisher } from './events/admin.event.publisher';

import { AdminActionCenterService } from './services/admin-action-center.service';

import { AdminCommandCenterService } from './services/admin-command-center.service';

import { AdminEnterpriseDashboardService } from './services/admin-enterprise-dashboard.service';

import { AdminInsightService } from './services/admin-insight.service';

import { AdminOperationsAlertService } from './services/admin-operations-alert.service';

import { AdminOperationsAlertAnalyticsService } from './services/admin-operations-alert-analytics.service';

import { AdminOperationsAlertEscalationService } from './services/admin-operations-alert-escalation.service';

import { AdminOperationsDigestService } from './services/admin-operations-digest.service';

import { AdminOperationsDigestNotificationService } from './services/admin-operations-digest-notification.service';

import { AdminOperationsHealthService } from './services/admin-operations-health.service';

import { AdminOperationsQueueAlertLifecycleService } from './services/admin-operations-queue-alert-lifecycle.service';

import { AdminOperationsWatchdogService } from './services/admin-operations-watchdog.service';

import { AdminQueueService } from './services/admin-queue.service';

import { AdminScheduledOperationsDigestService } from './services/admin-scheduled-operations-digest.service';

import { AdminSchedulerService } from './services/admin-scheduler.service';

import { AdminService } from './services/admin.service';

import { AdminTimelineService } from './services/admin-timeline.service';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    CoreQueueModule,
    CoreSchedulerModule,
    NotificationModule,
  ],
  controllers: [
    AdminController,
    AdminActionCenterController,
    AdminCommandCenterController,
    AdminEnterpriseDashboardController,
    AdminInsightController,
    AdminOperationsAlertController,
    AdminOperationsAlertAnalyticsController,
    AdminOperationsAlertEscalationController,
    AdminOperationsDigestController,
    AdminOperationsDigestNotificationController,
    AdminOperationsHealthController,
    AdminOperationsWatchdogController,
    AdminScheduledOperationsDigestController,
    AdminTimelineController,
  ],
  providers: [
    AdminService,
    AdminActionCenterService,
    AdminCommandCenterService,
    AdminEnterpriseDashboardService,
    AdminInsightService,
    AdminOperationsAlertService,
    AdminOperationsAlertAnalyticsService,
    AdminOperationsAlertEscalationService,
    AdminOperationsDigestService,
    AdminOperationsDigestNotificationService,
    AdminOperationsHealthService,
    AdminOperationsQueueAlertLifecycleService,
    AdminOperationsWatchdogService,
    AdminQueueService,
    AdminScheduledOperationsDigestService,
    AdminSchedulerService,
    AdminTimelineService,
    AdminEventPublisher,
    AdminEventHandler,
  ],
  exports: [
    AdminService,
    AdminActionCenterService,
    AdminCommandCenterService,
    AdminEnterpriseDashboardService,
    AdminInsightService,
    AdminOperationsAlertService,
    AdminOperationsAlertAnalyticsService,
    AdminOperationsAlertEscalationService,
    AdminOperationsDigestService,
    AdminOperationsDigestNotificationService,
    AdminOperationsHealthService,
    AdminOperationsQueueAlertLifecycleService,
    AdminOperationsWatchdogService,
    AdminScheduledOperationsDigestService,
    AdminTimelineService,
  ],
})
export class AdminModule {}
