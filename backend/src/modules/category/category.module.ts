import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacModule } from '../rbac/rbac.module';

import { CategoryAdminController } from './category-admin.controller';

import { CategoryController } from './category.controller';

import { CategoryEventHandler } from './events/category.event.handler';

import { CategoryEventPublisher } from './events/category.event.publisher';

import { AdminCategoryService } from './services/admin-category.service';

import { AdminCategoryTreeService } from './services/admin-category-tree.service';

import { CategoryService } from './services/category.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [CategoryController, CategoryAdminController],
  providers: [
    CategoryService,
    AdminCategoryService,
    AdminCategoryTreeService,
    CategoryEventPublisher,
    CategoryEventHandler,
  ],
  exports: [
    CategoryService,
    AdminCategoryService,
    AdminCategoryTreeService,
    CategoryEventPublisher,
  ],
})
export class CategoryModule {}
