import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { MediaEventType } from './media.event.types';

import {
  BrandLogoUpdatedEventPayload,
  CategoryImageUpdatedEventPayload,
  FileDeletedEventPayload,
  FileUploadedEventPayload,
  ProductImageAttachedEventPayload,
  ProductImageDeletedEventPayload,
  ProductImagePrimarySetEventPayload,
  ProductImagesReorderedEventPayload,
  ProductImageUpdatedEventPayload,
  UserAvatarUpdatedEventPayload,
  VariantImageUpdatedEventPayload,
} from './media.event.payloads';

@Injectable()
export class MediaEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishFileUploaded(payload: FileUploadedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.FILE_UPLOADED, payload);
  }

  publishFileDeleted(payload: FileDeletedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.FILE_DELETED, payload);
  }

  publishProductImageAttached(payload: ProductImageAttachedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.PRODUCT_IMAGE_ATTACHED, payload);
  }

  publishProductImageUpdated(payload: ProductImageUpdatedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.PRODUCT_IMAGE_UPDATED, payload);
  }

  publishProductImageDeleted(payload: ProductImageDeletedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.PRODUCT_IMAGE_DELETED, payload);
  }

  publishProductImagePrimarySet(
    payload: ProductImagePrimarySetEventPayload,
  ): void {
    this.eventEmitter.emit(MediaEventType.PRODUCT_IMAGE_PRIMARY_SET, payload);
  }

  publishProductImagesReordered(
    payload: ProductImagesReorderedEventPayload,
  ): void {
    this.eventEmitter.emit(MediaEventType.PRODUCT_IMAGES_REORDERED, payload);
  }

  publishBrandLogoUpdated(payload: BrandLogoUpdatedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.BRAND_LOGO_UPDATED, payload);
  }

  publishCategoryImageUpdated(payload: CategoryImageUpdatedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.CATEGORY_IMAGE_UPDATED, payload);
  }

  publishUserAvatarUpdated(payload: UserAvatarUpdatedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.USER_AVATAR_UPDATED, payload);
  }

  publishVariantImageUpdated(payload: VariantImageUpdatedEventPayload): void {
    this.eventEmitter.emit(MediaEventType.VARIANT_IMAGE_UPDATED, payload);
  }
}
