import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class MediaEventHandler {
  private readonly logger = new Logger(MediaEventHandler.name);

  @OnEvent(MediaEventType.FILE_UPLOADED)
  handleFileUploaded(payload: FileUploadedEventPayload): void {
    this.logger.log(
      `File uploaded: ${payload.url}; size=${payload.size}; mime=${payload.mimeType}`,
    );
  }

  @OnEvent(MediaEventType.FILE_DELETED)
  handleFileDeleted(payload: FileDeletedEventPayload): void {
    this.logger.warn(
      `File deleted: ${payload.key ?? payload.url ?? 'unknown'}`,
    );
  }

  @OnEvent(MediaEventType.PRODUCT_IMAGE_ATTACHED)
  handleProductImageAttached(payload: ProductImageAttachedEventPayload): void {
    this.logger.log(
      `Product image attached: product=${payload.productId}; image=${payload.imageId}`,
    );
  }

  @OnEvent(MediaEventType.PRODUCT_IMAGE_UPDATED)
  handleProductImageUpdated(payload: ProductImageUpdatedEventPayload): void {
    this.logger.log(
      `Product image updated: image=${payload.imageId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(MediaEventType.PRODUCT_IMAGE_DELETED)
  handleProductImageDeleted(payload: ProductImageDeletedEventPayload): void {
    this.logger.warn(
      `Product image deleted: product=${payload.productId}; image=${payload.imageId}`,
    );
  }

  @OnEvent(MediaEventType.PRODUCT_IMAGE_PRIMARY_SET)
  handleProductImagePrimarySet(
    payload: ProductImagePrimarySetEventPayload,
  ): void {
    this.logger.log(
      `Primary product image set: product=${payload.productId}; image=${payload.imageId}`,
    );
  }

  @OnEvent(MediaEventType.PRODUCT_IMAGES_REORDERED)
  handleProductImagesReordered(
    payload: ProductImagesReorderedEventPayload,
  ): void {
    this.logger.log(
      `Product images reordered: product=${payload.productId}; count=${payload.imageIds.length}`,
    );
  }

  @OnEvent(MediaEventType.BRAND_LOGO_UPDATED)
  handleBrandLogoUpdated(payload: BrandLogoUpdatedEventPayload): void {
    this.logger.log(`Brand logo updated: brand=${payload.brandId}`);
  }

  @OnEvent(MediaEventType.CATEGORY_IMAGE_UPDATED)
  handleCategoryImageUpdated(payload: CategoryImageUpdatedEventPayload): void {
    this.logger.log(`Category image updated: category=${payload.categoryId}`);
  }

  @OnEvent(MediaEventType.USER_AVATAR_UPDATED)
  handleUserAvatarUpdated(payload: UserAvatarUpdatedEventPayload): void {
    this.logger.log(`User avatar updated: user=${payload.userId}`);
  }

  @OnEvent(MediaEventType.VARIANT_IMAGE_UPDATED)
  handleVariantImageUpdated(payload: VariantImageUpdatedEventPayload): void {
    this.logger.log(
      `Variant image updated: variant=${payload.variantId}; product=${payload.productId}`,
    );
  }
}
