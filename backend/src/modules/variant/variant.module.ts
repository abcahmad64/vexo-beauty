import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacModule } from '../rbac/rbac.module';

import { VariantController } from './variant.controller';

import { VariantEventHandler } from './events/variant.event.handler';

import { VariantEventPublisher } from './events/variant.event.publisher';

import { VariantService } from './services/variant.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [VariantController],
  providers: [VariantService, VariantEventPublisher, VariantEventHandler],
  exports: [VariantService, VariantEventPublisher],
})
export class VariantModule {}
