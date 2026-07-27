import { Injectable } from '@nestjs/common';

import { SchedulerManagerService } from '../../../core/scheduler/services/scheduler-manager.service';

@Injectable()
export class AdminSchedulerService {
  constructor(
    private readonly schedulerManagerService: SchedulerManagerService,
  ) {}

  getStatus() {
    return this.schedulerManagerService.getStatus();
  }

  runTask(taskName: string) {
    return this.schedulerManagerService.runTask(taskName);
  }
}
