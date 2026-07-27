import {
  MediaFileKind,
  MediaStorageDriver,
} from '../constants/media.constants';

export interface MediaBaseEventPayload {
  actorId?: string;
  occurredAt: Date;
}

export interface FileUploadedEventPayload extends MediaBaseEventPayload {
  url: string;
  key: string;
  driver: MediaStorageDriver;
  mimeType: string;
  size: number;
  kind: MediaFileKind;
}

export interface FileDeletedEventPayload extends MediaBaseEventPayload {
  url?: string;
  key?: string;
}

export interface ProductImageAttachedEventPayload extends MediaBaseEventPayload {
  productId: string;
  imageId: string;
  url: string;
  isPrimary: boolean;
}

export interface ProductImageUpdatedEventPayload extends MediaBaseEventPayload {
  productId: string;
  imageId: string;
  changedFields: string[];
}

export interface ProductImageDeletedEventPayload extends MediaBaseEventPayload {
  productId: string;
  imageId: string;
  url: string;
}

export interface ProductImagePrimarySetEventPayload extends MediaBaseEventPayload {
  productId: string;
  imageId: string;
}

export interface ProductImagesReorderedEventPayload extends MediaBaseEventPayload {
  productId: string;
  imageIds: string[];
}

export interface BrandLogoUpdatedEventPayload extends MediaBaseEventPayload {
  brandId: string;
  logoUrl: string | null;
}

export interface CategoryImageUpdatedEventPayload extends MediaBaseEventPayload {
  categoryId: string;
  imageUrl: string | null;
}

export interface UserAvatarUpdatedEventPayload extends MediaBaseEventPayload {
  userId: string;
  avatarUrl: string | null;
}

export interface VariantImageUpdatedEventPayload extends MediaBaseEventPayload {
  variantId: string;
  productId: string;
  imageUrl: string | null;
}
