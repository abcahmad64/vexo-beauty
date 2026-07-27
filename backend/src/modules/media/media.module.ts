import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { MulterModule } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { AiModule } from '../ai/ai.module';

import { RbacModule } from '../rbac/rbac.module';

import { MediaConstants } from './constants/media.constants';

import { MediaEventHandler } from './events/media.event.handler';

import { MediaEventPublisher } from './events/media.event.publisher';

import { AvatarController } from './avatar.controller';

import { MediaAdminController } from './media-admin.controller';

import { MediaController } from './media.controller';

import { MediaQueueProcessor } from './processors/media-queue.processor';

import { AdminMediaExportService } from './services/admin-media-export.service';

import { AdminMediaAiService } from './services/admin-media-ai.service';

import { AdminMediaService } from './services/admin-media.service';

import { MediaService } from './services/media.service';

import { MediaStorageService } from './services/media-storage.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    CoreQueueModule,
    AiModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize:
            configService.get<number>('MEDIA_MAX_FILE_SIZE_BYTES') ??
            MediaConstants.MAX_FILE_SIZE_BYTES,
        },
      }),
    }),
  ],
  controllers: [MediaController, MediaAdminController, AvatarController],
  providers: [
    MediaService,
    AdminMediaService,
    AdminMediaAiService,
    AdminMediaExportService,
    MediaStorageService,
    MediaEventPublisher,
    MediaEventHandler,
    MediaQueueProcessor,
  ],
  exports: [
    MediaService,
    AdminMediaService,
    AdminMediaAiService,
    AdminMediaExportService,
    MediaStorageService,
    MediaEventPublisher,
  ],
})
export class MediaModule {}
