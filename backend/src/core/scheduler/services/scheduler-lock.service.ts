import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import type { SchedulerLockExecutionResult } from '../types/scheduler.types';

type AdvisoryLockRow = {
  readonly locked: boolean;
};

@Injectable()
export class SchedulerLockService {
  private readonly logger = new Logger(SchedulerLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async executeWithLock<T>(
    lockKey: string,
    callback: () => Promise<T>,
  ): Promise<SchedulerLockExecutionResult<T>> {
    const normalizedLockKey = this.normalizeLockKey(lockKey);

    try {
      return await this.prisma.$transaction(
        async (tx): Promise<SchedulerLockExecutionResult<T>> => {
          const rows = await tx.$queryRaw<AdvisoryLockRow[]>(
            Prisma.sql`
              SELECT
                pg_try_advisory_xact_lock(
                  hashtext(${normalizedLockKey})::bigint
                ) AS "locked"
            `,
          );

          const locked = rows[0]?.locked === true;

          if (!locked) {
            this.logger.warn(
              `اجرای scheduler task به دلیل فعال بودن lock نادیده گرفته شد: ${normalizedLockKey}`,
            );

            return {
              locked: false,
            };
          }

          const result = await callback();

          return {
            locked: true,
            result,
          };
        },
      );
    } catch (error) {
      this.logger.error(
        `دریافت یا اجرای scheduler lock ناموفق بود: ${normalizedLockKey}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  private normalizeLockKey(lockKey: string): string {
    if (typeof lockKey !== 'string') {
      throw new BadRequestException('کلید lock زمان‌بند معتبر نیست.');
    }

    const normalizedLockKey = lockKey.trim();

    if (normalizedLockKey.length === 0) {
      throw new BadRequestException('کلید lock زمان‌بند نمی‌تواند خالی باشد.');
    }

    return normalizedLockKey.length <= 256
      ? normalizedLockKey
      : normalizedLockKey.slice(0, 256);
  }
}
