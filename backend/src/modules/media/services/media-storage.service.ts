import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';

import { dirname, extname, posix, resolve } from 'path';

import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';

import {
  MediaConstants,
  MediaFileKind,
  MediaFolder,
  MEDIA_MIME_EXTENSION_MAP,
  MediaStorageDriver,
} from '../constants/media.constants';

import { MediaUploadResult } from '../interfaces/media-upload-result.interface';

export type MediaUploadOptions = {
  readonly folder?: MediaFolder | string;
  readonly entityId?: string;
  readonly allowedKinds?: readonly MediaFileKind[];
};

export type MediaCleanupTemporaryOptions = {
  readonly olderThanMinutes: number;
  readonly dryRun: boolean;
};

export type MediaCleanupTemporaryResult = {
  readonly driver: MediaStorageDriver;
  readonly dryRun: boolean;
  readonly olderThanMinutes: number;
  readonly scannedFiles: number;
  readonly deletedFiles: number;
  readonly skippedFiles: number;
  readonly candidateFolders: readonly string[];
  readonly deletedKeys: readonly string[];
  readonly skippedReason?: string;
};

type BuildObjectKeyInput = {
  readonly folder: string;
  readonly entityId?: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
};

type CleanupTraversalResult = {
  scannedFiles: number;
  deletedFiles: number;
  skippedFiles: number;
  deletedKeys: string[];
};

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  private readonly temporaryFolders = ['temporary', 'temp', 'tmp'] as const;

  async uploadFile(
    file: Express.Multer.File,
    options: MediaUploadOptions = {},
  ): Promise<MediaUploadResult> {
    this.validateFile(file, options.allowedKinds);

    const folder = this.normalizePathSegment(
      options.folder ?? MediaFolder.GENERAL,
    );

    const entityId = options.entityId
      ? this.normalizePathSegment(options.entityId)
      : undefined;

    const kind = this.detectFileKind(file.mimetype);

    const key = this.buildObjectKey({
      folder,
      entityId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    if (MediaConstants.DEFAULT_DRIVER === MediaStorageDriver.BUNNY) {
      return this.uploadToBunny(file, key, folder, kind);
    }

    return this.uploadToLocal(file, key, folder, kind);
  }

  async deleteByUrl(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    const key = this.extractKeyFromUrl(url);

    if (!key) {
      return;
    }

    if (MediaConstants.DEFAULT_DRIVER === MediaStorageDriver.BUNNY) {
      await this.deleteFromBunny(key);
      return;
    }

    await this.deleteFromLocal(key);
  }

  async cleanupTemporaryFiles(
    options: MediaCleanupTemporaryOptions,
  ): Promise<MediaCleanupTemporaryResult> {
    const olderThanMinutes = this.normalizeCleanupAge(options.olderThanMinutes);

    if (MediaConstants.DEFAULT_DRIVER === MediaStorageDriver.BUNNY) {
      return {
        driver: MediaStorageDriver.BUNNY,
        dryRun: options.dryRun,
        olderThanMinutes,
        scannedFiles: 0,
        deletedFiles: 0,
        skippedFiles: 0,
        candidateFolders: this.temporaryFolders,
        deletedKeys: [],
        skippedReason:
          'پاک‌سازی فایل‌های موقت Bunny نیازمند پیاده‌سازی API لیست‌کردن فایل‌ها است و فعلاً به‌صورت ایمن اجرا نشد.',
      };
    }

    const root = resolve(process.cwd(), MediaConstants.LOCAL_ROOT);

    const cutoffTime = Date.now() - olderThanMinutes * 60 * 1_000;

    const aggregate: CleanupTraversalResult = {
      scannedFiles: 0,
      deletedFiles: 0,
      skippedFiles: 0,
      deletedKeys: [],
    };

    for (const folder of this.temporaryFolders) {
      const folderPath = this.resolveSafeLocalPath(root, folder);

      const exists = await this.pathExists(folderPath);

      if (!exists) {
        continue;
      }

      const folderStat = await stat(folderPath);

      if (!folderStat.isDirectory()) {
        aggregate.skippedFiles += 1;
        continue;
      }

      const result = await this.cleanupLocalDirectory(
        root,
        folderPath,
        cutoffTime,
        options.dryRun,
      );

      aggregate.scannedFiles += result.scannedFiles;

      aggregate.deletedFiles += result.deletedFiles;

      aggregate.skippedFiles += result.skippedFiles;

      aggregate.deletedKeys.push(...result.deletedKeys);
    }

    return {
      driver: MediaStorageDriver.LOCAL,
      dryRun: options.dryRun,
      olderThanMinutes,
      scannedFiles: aggregate.scannedFiles,
      deletedFiles: aggregate.deletedFiles,
      skippedFiles: aggregate.skippedFiles,
      candidateFolders: this.temporaryFolders,
      deletedKeys: aggregate.deletedKeys,
    };
  }

  detectFileKind(mimeType: string): MediaFileKind {
    if (mimeType.startsWith('image/')) {
      return MediaFileKind.IMAGE;
    }

    if (mimeType.startsWith('video/')) {
      return MediaFileKind.VIDEO;
    }

    if (mimeType === 'application/pdf') {
      return MediaFileKind.PDF;
    }

    return MediaFileKind.OTHER;
  }

  private validateFile(
    file: Express.Multer.File | undefined,
    allowedKinds?: readonly MediaFileKind[],
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('فایل برای بارگذاری الزامی است.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('فایل ارسال‌شده خالی یا نامعتبر است.');
    }

    if (!file.originalname || file.originalname.trim().length === 0) {
      throw new BadRequestException('نام فایل معتبر نیست.');
    }

    if (
      !file.mimetype ||
      !MediaConstants.ALLOWED_MIME_TYPES.includes(file.mimetype)
    ) {
      throw new BadRequestException('نوع فایل پشتیبانی نمی‌شود.');
    }

    if (file.size <= 0 || file.size > MediaConstants.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `حجم فایل باید کمتر از ${this.formatBytes(
          MediaConstants.MAX_FILE_SIZE_BYTES,
        )} باشد.`,
      );
    }

    const kind = this.detectFileKind(file.mimetype);

    if (
      allowedKinds &&
      allowedKinds.length > 0 &&
      !allowedKinds.includes(kind)
    ) {
      throw new BadRequestException('نوع فایل برای این عملیات مجاز نیست.');
    }

    if (file.mimetype === 'image/svg+xml' && !MediaConstants.ALLOW_SVG) {
      throw new BadRequestException(
        'بارگذاری فایل SVG به دلایل امنیتی مجاز نیست.',
      );
    }
  }

  private async uploadToLocal(
    file: Express.Multer.File,
    key: string,
    folder: string,
    kind: MediaFileKind,
  ): Promise<MediaUploadResult> {
    const root = resolve(process.cwd(), MediaConstants.LOCAL_ROOT);

    const absolutePath = this.resolveSafeLocalPath(root, key);

    await mkdir(dirname(absolutePath), {
      recursive: true,
    });

    await writeFile(absolutePath, file.buffer);

    return {
      url: this.buildLocalUrl(key),
      key,
      driver: MediaStorageDriver.LOCAL,
      folder,
      originalName: file.originalname,
      storedName: posix.basename(key),
      mimeType: file.mimetype,
      size: file.size,
      kind,
    };
  }

  private async uploadToBunny(
    file: Express.Multer.File,
    key: string,
    folder: string,
    kind: MediaFileKind,
  ): Promise<MediaUploadResult> {
    if (
      !MediaConstants.BUNNY_STORAGE_ZONE ||
      !MediaConstants.BUNNY_STORAGE_API_KEY ||
      !MediaConstants.BUNNY_CDN_URL
    ) {
      throw new InternalServerErrorException(
        'تنظیمات Bunny Storage کامل نیست.',
      );
    }

    const storageUrl = this.joinUrl(
      this.joinUrl(
        MediaConstants.BUNNY_STORAGE_ENDPOINT,
        MediaConstants.BUNNY_STORAGE_ZONE,
      ),
      key,
    );

    const response = await this.requestBunny(
      storageUrl,
      {
        method: 'PUT',
        headers: {
          AccessKey: MediaConstants.BUNNY_STORAGE_API_KEY,
          'Content-Type': file.mimetype,
        },
        body: file.buffer,
      },
      'upload',
    );

    if (!response.ok) {
      await this.discardResponseBody(response);

      this.logger.warn(
        `Bunny Storage upload failed with status ${response.status}.`,
      );

      throw new InternalServerErrorException(
        'بارگذاری فایل در فضای ذخیره‌سازی خارجی ناموفق بود.',
      );
    }

    await this.discardResponseBody(response);

    return {
      url: this.joinUrl(MediaConstants.BUNNY_CDN_URL, key),
      key,
      driver: MediaStorageDriver.BUNNY,
      folder,
      originalName: file.originalname,
      storedName: posix.basename(key),
      mimeType: file.mimetype,
      size: file.size,
      kind,
    };
  }

  private async deleteFromLocal(key: string): Promise<void> {
    const root = resolve(process.cwd(), MediaConstants.LOCAL_ROOT);

    const absolutePath = this.resolveSafeLocalPath(root, key);

    await rm(absolutePath, {
      force: true,
    });
  }

  private async deleteFromBunny(key: string): Promise<void> {
    if (
      !MediaConstants.BUNNY_STORAGE_ZONE ||
      !MediaConstants.BUNNY_STORAGE_API_KEY
    ) {
      return;
    }

    const storageUrl = this.joinUrl(
      this.joinUrl(
        MediaConstants.BUNNY_STORAGE_ENDPOINT,
        MediaConstants.BUNNY_STORAGE_ZONE,
      ),
      key,
    );

    const response = await this.requestBunny(
      storageUrl,
      {
        method: 'DELETE',
        headers: {
          AccessKey: MediaConstants.BUNNY_STORAGE_API_KEY,
        },
      },
      'delete',
    );

    if (response.status === 404) {
      await this.discardResponseBody(response);
      return;
    }

    if (!response.ok) {
      await this.discardResponseBody(response);

      this.logger.warn(
        `Bunny Storage delete failed with status ${response.status}.`,
      );

      throw new InternalServerErrorException(
        'حذف فایل از فضای ذخیره‌سازی خارجی ناموفق بود.',
      );
    }

    await this.discardResponseBody(response);
  }

  private async cleanupLocalDirectory(
    root: string,
    directoryPath: string,
    cutoffTime: number,
    dryRun: boolean,
  ): Promise<CleanupTraversalResult> {
    const result: CleanupTraversalResult = {
      scannedFiles: 0,
      deletedFiles: 0,
      skippedFiles: 0,
      deletedKeys: [],
    };

    const entries = await readdir(directoryPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const absolutePath = resolve(directoryPath, entry.name);

      if (!absolutePath.startsWith(`${root}`)) {
        result.skippedFiles += 1;
        continue;
      }

      if (entry.isDirectory()) {
        const nested = await this.cleanupLocalDirectory(
          root,
          absolutePath,
          cutoffTime,
          dryRun,
        );

        result.scannedFiles += nested.scannedFiles;

        result.deletedFiles += nested.deletedFiles;

        result.skippedFiles += nested.skippedFiles;

        result.deletedKeys.push(...nested.deletedKeys);

        await this.removeDirectoryIfEmpty(absolutePath, root, dryRun);

        continue;
      }

      if (!entry.isFile()) {
        result.skippedFiles += 1;
        continue;
      }

      result.scannedFiles += 1;

      const fileStat = await stat(absolutePath);

      if (fileStat.mtimeMs > cutoffTime) {
        result.skippedFiles += 1;
        continue;
      }

      const key = this.relativeKeyFromAbsolutePath(root, absolutePath);

      this.assertSafeObjectKey(key);

      if (!dryRun) {
        await rm(absolutePath, {
          force: true,
        });
      }

      result.deletedFiles += 1;
      result.deletedKeys.push(key);
    }

    return result;
  }

  private async removeDirectoryIfEmpty(
    directoryPath: string,
    root: string,
    dryRun: boolean,
  ): Promise<void> {
    if (dryRun) {
      return;
    }

    if (directoryPath === root) {
      return;
    }

    const entries = await readdir(directoryPath);

    if (entries.length > 0) {
      return;
    }

    await rm(directoryPath, {
      recursive: false,
      force: true,
    });
  }

  private buildObjectKey(input: BuildObjectKeyInput): string {
    const extension = this.resolveExtension(input.originalName, input.mimeType);

    const baseName = this.resolveSafeBaseName(input.originalName);

    const contentHash = createHash('sha256')
      .update(input.buffer)
      .digest('hex')
      .slice(0, 16);

    const date = new Date();

    const year = String(date.getFullYear());

    const month = String(date.getMonth() + 1).padStart(2, '0');

    const storedName = [Date.now(), randomUUID(), contentHash, baseName]
      .filter(Boolean)
      .join('-')
      .concat(extension);

    const parts = [
      input.folder,
      input.entityId,
      year,
      month,
      storedName,
    ].filter(Boolean) as string[];

    const key = posix.join(...parts);

    this.assertSafeObjectKey(key);

    return key;
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const extensionByMime = MEDIA_MIME_EXTENSION_MAP[mimeType];

    if (extensionByMime) {
      return extensionByMime;
    }

    const current = extname(originalName)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');

    return current;
  }

  private resolveSafeBaseName(originalName: string): string {
    const nameWithoutExtension = originalName.replace(
      extname(originalName),
      '',
    );

    const normalizedName = nameWithoutExtension
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    return normalizedName || 'file';
  }

  private extractKeyFromUrl(url: string): string | null {
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      return null;
    }

    if (this.looksLikeObjectKey(cleanUrl)) {
      return this.normalizeExtractedKey(cleanUrl);
    }

    const bunnyKey = this.extractKeyFromBaseUrl(
      cleanUrl,
      MediaConstants.BUNNY_CDN_URL,
    );

    if (bunnyKey) {
      return bunnyKey;
    }

    return this.extractKeyFromBaseUrl(cleanUrl, MediaConstants.PUBLIC_BASE_URL);
  }

  private extractKeyFromBaseUrl(value: string, baseUrl: string): string | null {
    const normalizedBase = baseUrl.trim().replace(/\/+$/g, '');

    if (!normalizedBase) {
      return null;
    }

    if (normalizedBase.startsWith('/')) {
      if (value !== normalizedBase && !value.startsWith(`${normalizedBase}/`)) {
        return null;
      }

      return this.normalizeExtractedKey(value.slice(normalizedBase.length));
    }

    try {
      const parsedValue = new URL(value);

      const parsedBase = new URL(normalizedBase);

      const basePath = parsedBase.pathname.replace(/\/+$/g, '');

      if (
        parsedValue.origin !== parsedBase.origin ||
        (basePath &&
          parsedValue.pathname !== basePath &&
          !parsedValue.pathname.startsWith(`${basePath}/`))
      ) {
        return null;
      }

      const relativePath = basePath
        ? parsedValue.pathname.slice(basePath.length)
        : parsedValue.pathname;

      return this.normalizeExtractedKey(relativePath);
    } catch {
      return null;
    }
  }

  private normalizeExtractedKey(value: string): string | null {
    const key = value.replace(/^\/+/, '').replace(/\/+$/g, '');

    if (!key) {
      return null;
    }

    try {
      this.assertSafeObjectKey(key);
      return key;
    } catch {
      return null;
    }
  }

  private looksLikeObjectKey(value: string): boolean {
    return (
      !value.startsWith('http://') &&
      !value.startsWith('https://') &&
      !value.startsWith('//') &&
      !value.includes('..') &&
      value.includes('/')
    );
  }

  private buildLocalUrl(key: string): string {
    return this.joinUrl(MediaConstants.PUBLIC_BASE_URL, key);
  }

  private joinUrl(base: string, key: string): string {
    return `${base.replace(/\/+$/g, '')}/${key.replace(/^\/+/g, '')}`;
  }

  private normalizePathSegment(value: string): string {
    const normalizedValue = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalizedValue) {
      throw new BadRequestException('مسیر ذخیره‌سازی فایل معتبر نیست.');
    }

    return normalizedValue;
  }

  private normalizeCleanupAge(olderThanMinutes: number): number {
    const value = Number(olderThanMinutes);

    if (!Number.isFinite(value) || value < 1 || value > 525_600) {
      throw new BadRequestException(
        'مدت زمان پاک‌سازی فایل‌های موقت معتبر نیست.',
      );
    }

    return Math.floor(value);
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private relativeKeyFromAbsolutePath(
    root: string,
    absolutePath: string,
  ): string {
    const relative = absolutePath
      .replace(root, '')
      .replace(/^[\\/]+/, '')
      .replace(/\\/g, '/');

    this.assertSafeObjectKey(relative);

    return relative;
  }

  private assertSafeObjectKey(key: string): void {
    const segments = key.split('/');

    const isSafe = segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\'),
    );

    if (!isSafe) {
      throw new BadRequestException('مسیر فایل معتبر نیست.');
    }
  }

  private resolveSafeLocalPath(root: string, key: string): string {
    this.assertSafeObjectKey(key);

    const absolutePath = resolve(root, key);

    if (!absolutePath.startsWith(`${root}`)) {
      throw new BadRequestException('مسیر فایل خارج از محدوده مجاز است.');
    }

    return absolutePath;
  }

  private formatBytes(bytes: number): string {
    const megabytes = bytes / 1024 / 1024;

    return `${megabytes.toFixed(1)} مگابایت`;
  }

  private async requestBunny(
    url: string,
    init: RequestInit,
    operation: 'upload' | 'delete',
  ): Promise<Response> {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      MediaConstants.REQUEST_TIMEOUT_MS,
    );

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'network';

      this.logger.warn(
        `Bunny Storage ${operation} request failed (${reason}).`,
      );

      throw new InternalServerErrorException(
        'ارتباط با فضای ذخیره‌سازی خارجی ناموفق بود.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async discardResponseBody(response: Response): Promise<void> {
    try {
      await response.body?.cancel();
    } catch {
      // The provider response body is intentionally ignored.
    }
  }
}
