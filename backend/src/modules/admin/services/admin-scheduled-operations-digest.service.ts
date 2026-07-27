import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { AdminOperationsDigestNotificationChannel } from '../dto/notify-admin-operations-digest.dto';

import { AdminOperationsDigestNotificationService } from './admin-operations-digest-notification.service';

type ScheduledDigestStatus = {
  enabled: boolean;
  cron: string;
  timezone: string;
  currency: string | null;
  mode: 'compact' | 'full';
  channels: AdminOperationsDigestNotificationChannel[];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastResult: unknown;
};

@Injectable()
export class AdminScheduledOperationsDigestService {
  private readonly logger = new Logger(
    AdminScheduledOperationsDigestService.name,
  );

  private lastRunAt: Date | null = null;

  private lastSuccessAt: Date | null = null;

  private lastFailureAt: Date | null = null;

  private lastResult: unknown = null;

  constructor(
    private readonly digestNotificationService: AdminOperationsDigestNotificationService,
  ) {}

  @Cron('0 8 * * *', {
    timeZone: 'Asia/Tehran',
  })
  async sendDailyDigest(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.runScheduledDigest('system:scheduled-admin-digest');
  }

  async runNow(actorId: string): Promise<ScheduledDigestStatus> {
    await this.runScheduledDigest(actorId);

    return this.getStatus();
  }

  getStatus(): ScheduledDigestStatus {
    return {
      enabled: this.isEnabled(),
      cron: '0 8 * * *',
      timezone: 'Asia/Tehran',
      currency: this.getCurrency(),
      mode: this.getMode(),
      channels: this.getChannels(),
      lastRunAt: this.lastRunAt ? this.lastRunAt.toISOString() : null,
      lastSuccessAt: this.lastSuccessAt
        ? this.lastSuccessAt.toISOString()
        : null,
      lastFailureAt: this.lastFailureAt
        ? this.lastFailureAt.toISOString()
        : null,
      lastResult: this.lastResult,
    };
  }

  private async runScheduledDigest(actorId: string): Promise<void> {
    this.lastRunAt = new Date();

    try {
      const result = await this.digestNotificationService.notifyAdmins(
        {
          currency: this.getCurrency() ?? undefined,
          mode: this.getMode(),
          channels: this.getChannels(),
        },
        actorId,
      );

      this.lastSuccessAt = new Date();

      this.lastResult = result;

      this.logger.log(
        `Scheduled admin operations digest sent to ${result.sentCount} admin recipient(s).`,
      );
    } catch (error) {
      this.lastFailureAt = new Date();

      this.lastResult = {
        error: error instanceof Error ? error.message : String(error),
      };

      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private isEnabled(): boolean {
    return process.env.ADMIN_OPERATIONS_DIGEST_SCHEDULE_ENABLED === 'true';
  }

  private getCurrency(): string | null {
    const value = process.env.ADMIN_OPERATIONS_DIGEST_CURRENCY?.trim();

    return value && value.length > 0 ? value : null;
  }

  private getMode(): 'compact' | 'full' {
    const value = process.env.ADMIN_OPERATIONS_DIGEST_MODE?.trim();

    return value === 'full' ? 'full' : 'compact';
  }

  private getChannels(): AdminOperationsDigestNotificationChannel[] {
    const raw = process.env.ADMIN_OPERATIONS_DIGEST_CHANNELS?.trim();

    if (!raw) {
      return ['database', 'websocket', 'push'];
    }

    const channels = raw
      .split(',')
      .map((item) => item.trim())
      .filter(
        (item): item is AdminOperationsDigestNotificationChannel =>
          item === 'database' ||
          item === 'websocket' ||
          item === 'push' ||
          item === 'email',
      );

    return channels.length > 0 ? channels : ['database', 'websocket', 'push'];
  }
}
