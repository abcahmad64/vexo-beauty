import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { CollectionAdminController } from './collection-admin.controller';

import { AdminCollectionService } from './services/admin-collection.service';

@Module({
  imports: [PrismaModule],
  controllers: [CollectionAdminController],
  providers: [AdminCollectionService],
  exports: [AdminCollectionService],
})
export class CollectionModule {}
