import {
  MediaFileKind,
  MediaStorageDriver,
} from '../constants/media.constants';

export interface MediaUploadResult {
  readonly url: string;
  readonly key: string;
  readonly driver: MediaStorageDriver;
  readonly folder: string;
  readonly originalName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly kind: MediaFileKind;
}
