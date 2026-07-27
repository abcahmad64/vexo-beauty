import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { CatalogIntelligenceEnqueueService } from '../services/catalog-intelligence-enqueue.service';

import { ProductEventType } from './product.event.types';

import {
  ProductAttributesSyncedEventPayload,
  ProductCreatedEventPayload,
  ProductDeletedEventPayload,
  ProductImageAddedEventPayload,
  ProductStatusChangedEventPayload,
  ProductUpdatedEventPayload,
  ProductVariantAddedEventPayload,
  ProductVariantDeletedEventPayload,
  ProductVariantUpdatedEventPayload,
  ProductViewedEventPayload,
} from './product.event.payloads';

@Injectable()
export class ProductEventHandler {
  private readonly logger = new Logger(ProductEventHandler.name);

  constructor(
    private readonly catalogIntelligenceEnqueueService: CatalogIntelligenceEnqueueService,
  ) {}

  @OnEvent(ProductEventType.CREATED)
  async handleCreated(payload: ProductCreatedEventPayload): Promise<void> {
    this.logger.log(`Product created: ${payload.name}; sku=${payload.sku}`);

    try {
      await this.catalogIntelligenceEnqueueService.enqueueForCreatedProduct(
        payload,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Catalog research enqueue failed: ${payload.productId}; ${message}`,
      );
    }
  }

  @OnEvent(ProductEventType.UPDATED)
  handleUpdated(payload: ProductUpdatedEventPayload): void {
    this.logger.log(
      `Product updated: ${payload.productId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(ProductEventType.STATUS_CHANGED)
  handleStatusChanged(payload: ProductStatusChangedEventPayload): void {
    this.logger.log(
      `Product status changed: ${payload.productId}; ${payload.previousStatus} -> ${payload.currentStatus}`,
    );
  }

  @OnEvent(ProductEventType.DELETED)
  handleDeleted(payload: ProductDeletedEventPayload): void {
    this.logger.warn(
      `Product soft deleted: ${payload.name}; slug=${payload.slug}`,
    );
  }

  @OnEvent(ProductEventType.VIEWED)
  handleViewed(payload: ProductViewedEventPayload): void {
    this.logger.log(`Product viewed: ${payload.productId}`);
  }

  @OnEvent(ProductEventType.IMAGE_ADDED)
  handleImageAdded(payload: ProductImageAddedEventPayload): void {
    this.logger.log(
      `Product image added: ${payload.imageId}; product=${payload.productId}`,
    );
  }

  @OnEvent(ProductEventType.VARIANT_ADDED)
  handleVariantAdded(payload: ProductVariantAddedEventPayload): void {
    this.logger.log(
      `Product variant added: ${payload.variantId}; sku=${payload.sku}`,
    );
  }

  @OnEvent(ProductEventType.VARIANT_UPDATED)
  handleVariantUpdated(payload: ProductVariantUpdatedEventPayload): void {
    this.logger.log(
      `Product variant updated: ${payload.variantId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(ProductEventType.VARIANT_DELETED)
  handleVariantDeleted(payload: ProductVariantDeletedEventPayload): void {
    this.logger.warn(
      `Product variant soft deleted: ${payload.variantId}; sku=${payload.sku}`,
    );
  }

  @OnEvent(ProductEventType.ATTRIBUTES_SYNCED)
  handleAttributesSynced(payload: ProductAttributesSyncedEventPayload): void {
    this.logger.log(
      `Product attributes synced: ${payload.productId}; count=${payload.attributeValueIds.length}`,
    );
  }
}
