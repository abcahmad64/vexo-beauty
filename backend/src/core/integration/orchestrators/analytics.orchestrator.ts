import { Injectable, Logger } from '@nestjs/common';

import { QueueProducerService } from '../../queue/services/queue-producer.service';
import { QueueJobMetadataUtil } from '../../queue/utils/queue-job-metadata.util';

export interface AnalyticsEventInput {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly userId?: string | null;
  readonly actorId?: string | null;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly timestamp?: string | Date | null;
}

@Injectable()
export class AnalyticsOrchestrator {
  private readonly logger = new Logger(AnalyticsOrchestrator.name);

  constructor(private readonly queueProducerService: QueueProducerService) {}

  async record(input: AnalyticsEventInput): Promise<void> {
    const event = this.normalizeRequiredString(input.name);
    const entityType = this.normalizeRequiredString(input.category);
    const description = this.normalizeRequiredString(input.description);

    if (!event || !entityType || !description) {
      this.logger.warn('ثبت رویداد analytics انجام نشد؛ داده ضروری ناقص است.');
      return;
    }

    const userId = this.normalizeOptionalString(input.userId);
    const occurredAt = this.normalizeTimestamp(input.timestamp);

    try {
      await this.queueProducerService.enqueueAnalyticsCaptureEvent({
        event,
        entityType,
        entityId: this.resolveEntityId(input.data),
        payload: {
          ...(input.data ?? {}),
          description,
          userId,
          timestamp: occurredAt,
        },
        metadata: QueueJobMetadataUtil.create({
          actorId: this.normalizeOptionalString(input.actorId),
          source: 'analytics-orchestrator',
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت job analytics ناموفق بود: ${event}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private resolveEntityId(
    data?: Readonly<Record<string, unknown>>,
  ): string | undefined {
    if (!data) {
      return undefined;
    }

    const keys = [
      'entityId',
      'orderId',
      'orderNumber',
      'paymentId',
      'transactionId',
      'invoiceId',
      'invoiceNumber',
      'refundId',
      'shipmentId',
      'trackingNumber',
      'productId',
      'productSku',
      'variantId',
      'categoryId',
      'brandId',
      'userId',
      'customerId',
      'cartId',
      'wishlistId',
      'couponId',
      'reviewId',
      'notificationId',
      'mediaId',
      'aiTaskId',
      'aiRequestId',
    ];

    for (const key of keys) {
      const value = this.normalizeUnknownAsString(data[key]);

      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private normalizeTimestamp(value: string | Date | null | undefined): string {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      if (normalizedValue.length > 0) {
        const parsed = new Date(normalizedValue);

        if (Number.isFinite(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }

    return new Date().toISOString();
  }

  private normalizeRequiredString(value: string): string | null {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeOptionalString(
    value: string | null | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  private normalizeUnknownAsString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue.length > 0 ? normalizedValue : undefined;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    return undefined;
  }
}
