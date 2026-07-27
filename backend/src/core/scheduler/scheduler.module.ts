import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../prisma/prisma.module';
import { CoreQueueModule } from '../queue/queue.module';
import { SchedulerConfigService } from './services/scheduler-config.service';
import { SchedulerLockService } from './services/scheduler-lock.service';
import { SchedulerManagerService } from './services/scheduler-manager.service';
import { SchedulerRegistryService } from './services/scheduler-registry.service';
import { SchedulerTaskRunnerService } from './services/scheduler-task-runner.service';
import { MediaCleanupScheduler } from './tasks/media-cleanup.scheduler';
import { QueueHealthScheduler } from './tasks/queue-health.scheduler';

@Global()
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CoreQueueModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    SchedulerConfigService,
    SchedulerLockService,
    SchedulerTaskRunnerService,
    MediaCleanupScheduler,
    QueueHealthScheduler,
    SchedulerRegistryService,
    SchedulerManagerService,
  ],
  exports: [
    SchedulerConfigService,
    SchedulerLockService,
    SchedulerTaskRunnerService,
    SchedulerManagerService,
  ],
})
export class CoreSchedulerModule {}
