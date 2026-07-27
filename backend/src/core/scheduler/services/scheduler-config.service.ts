import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  SCHEDULER_DEFAULTS,
  SCHEDULER_ENV_KEYS,
} from '../constants/scheduler.constants';
import type { SchedulerConfig } from '../types/scheduler.types';

type ConfigPrimitive = string | number | boolean;

@Injectable()
export class SchedulerConfigService {
  constructor(private readonly configService: ConfigService) {}

  getConfig(): SchedulerConfig {
    return {
      enabled: this.getBoolean(
        [SCHEDULER_ENV_KEYS.ENABLED, 'scheduler.enabled'],
        SCHEDULER_DEFAULTS.ENABLED,
      ),
      timezone: this.getString(
        [SCHEDULER_ENV_KEYS.TIMEZONE, 'scheduler.timezone'],
        SCHEDULER_DEFAULTS.TIMEZONE,
      ),
      mediaCleanup: {
        enabled: this.getBoolean(
          [
            SCHEDULER_ENV_KEYS.MEDIA_CLEANUP_ENABLED,
            'scheduler.mediaCleanup.enabled',
          ],
          SCHEDULER_DEFAULTS.MEDIA_CLEANUP_ENABLED,
        ),
        cron: this.getString(
          [
            SCHEDULER_ENV_KEYS.MEDIA_CLEANUP_CRON,
            'scheduler.mediaCleanup.cron',
          ],
          SCHEDULER_DEFAULTS.MEDIA_CLEANUP_CRON,
        ),
        olderThanMinutes: this.getNumber(
          [
            SCHEDULER_ENV_KEYS.MEDIA_CLEANUP_OLDER_THAN_MINUTES,
            'scheduler.mediaCleanup.olderThanMinutes',
          ],
          SCHEDULER_DEFAULTS.MEDIA_CLEANUP_OLDER_THAN_MINUTES,
          {
            min: 1,
            max: 525_600,
          },
        ),
        dryRun: this.getBoolean(
          [
            SCHEDULER_ENV_KEYS.MEDIA_CLEANUP_DRY_RUN,
            'scheduler.mediaCleanup.dryRun',
          ],
          SCHEDULER_DEFAULTS.MEDIA_CLEANUP_DRY_RUN,
        ),
      },
      queueHealth: {
        enabled: this.getBoolean(
          [
            SCHEDULER_ENV_KEYS.QUEUE_HEALTH_ENABLED,
            'scheduler.queueHealth.enabled',
          ],
          SCHEDULER_DEFAULTS.QUEUE_HEALTH_ENABLED,
        ),
        cron: this.getString(
          [SCHEDULER_ENV_KEYS.QUEUE_HEALTH_CRON, 'scheduler.queueHealth.cron'],
          SCHEDULER_DEFAULTS.QUEUE_HEALTH_CRON,
        ),
        failedWarningThreshold: this.getNumber(
          [
            SCHEDULER_ENV_KEYS.QUEUE_HEALTH_FAILED_WARNING_THRESHOLD,
            'scheduler.queueHealth.failedWarningThreshold',
          ],
          SCHEDULER_DEFAULTS.QUEUE_HEALTH_FAILED_WARNING_THRESHOLD,
          {
            min: 1,
            max: 1_000_000,
          },
        ),
      },
    };
  }

  private getString(keys: readonly string[], fallback: string): string {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);

      if (typeof value === 'string') {
        const normalizedValue = value.trim();

        if (normalizedValue.length > 0) {
          return normalizedValue;
        }
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }

    return fallback;
  }

  private getBoolean(keys: readonly string[], fallback: boolean): boolean {
    for (const key of keys) {
      const value = this.configService.get<ConfigPrimitive>(key);

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'number') {
        return value === 1;
      }

      if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();

        if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
          return true;
        }

        if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
          return false;
        }
      }
    }

    return fallback;
  }

  private getNumber(
    keys: readonly string[],
    fallback: number,
    options?: {
      readonly min?: number;
      readonly max?: number;
    },
  ): number {
    const value = this.getString(keys, '');

    if (value.length === 0) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    if (options?.min !== undefined && parsed < options.min) {
      return fallback;
    }

    if (options?.max !== undefined && parsed > options.max) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
