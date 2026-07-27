import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { MulterModule } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { MediaConstants } from '../media/constants/media.constants';

import { MediaModule } from '../media/media.module';

import { ProductAdminController } from './product-admin.controller';

import { ProductCatalogAdminController } from './product-catalog-admin.controller';

import { ProductMediaUploadAdminController } from './product-media-upload-admin.controller';

import { ProductIntelligenceAdminController } from './product-intelligence-admin.controller';

import { ProductVariantAdminController } from './product-variant-admin.controller';

import { ProductController } from './product.controller';

import { ProductEventHandler } from './events/product.event.handler';

import { ProductEventPublisher } from './events/product.event.publisher';

import { AdminProductAiService } from './services/admin-product-ai.service';

import { AdminProductRegistrationAiService } from './services/admin-product-registration-ai.service';

import { AdminProductBulkService } from './services/admin-product-bulk.service';

import { AdminProductCatalogService } from './services/admin-product-catalog.service';

import { AdminProductExportService } from './services/admin-product-export.service';

import { AdminProductMediaUploadService } from './services/admin-product-media-upload.service';

import { AdminCatalogIntelligenceReviewService } from './services/admin-catalog-intelligence-review.service';

import { AdminProductSeoService } from './services/admin-product-seo.service';

import { AdminProductService } from './services/admin-product.service';

import { AdminProductVariantPriceService } from './services/admin-product-variant-price.service';

import { AdminProductVariantService } from './services/admin-product-variant.service';

import { CatalogIntelligenceEnqueueService } from './services/catalog-intelligence-enqueue.service';

import { ProductPublicService } from './services/product-public.service';

import { ProductService } from './services/product.service';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    MediaModule,
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
  controllers: [
    ProductController,
    ProductAdminController,
    ProductCatalogAdminController,
    ProductMediaUploadAdminController,
    ProductIntelligenceAdminController,
    ProductVariantAdminController,
  ],
  providers: [
    ProductService,
    ProductPublicService,
    AdminProductService,
    AdminProductAiService,
    AdminProductRegistrationAiService,
    AdminProductBulkService,
    AdminProductCatalogService,
    AdminProductMediaUploadService,
    AdminCatalogIntelligenceReviewService,
    AdminProductSeoService,
    AdminProductExportService,
    AdminProductVariantService,
    AdminProductVariantPriceService,
    CatalogIntelligenceEnqueueService,
    ProductEventPublisher,
    ProductEventHandler,
  ],
  exports: [
    ProductService,
    ProductPublicService,
    AdminProductService,
    AdminProductAiService,
    AdminProductBulkService,
    AdminProductCatalogService,
    AdminProductMediaUploadService,
    AdminProductSeoService,
    AdminProductExportService,
    AdminProductVariantService,
    AdminProductVariantPriceService,
    ProductEventPublisher,
  ],
})
export class ProductModule {}
