import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacModule } from '../rbac/rbac.module';

import { AttributeAdminController } from './attribute-admin.controller';

import { AttributeController } from './attribute.controller';

import { AttributeEventHandler } from './events/attribute.event.handler';

import { AttributeEventPublisher } from './events/attribute.event.publisher';

import { AdminAttributeService } from './services/admin-attribute.service';

import { AdminAttributeValueService } from './services/admin-attribute-value.service';

import { AttributeService } from './services/attribute.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [AttributeController, AttributeAdminController],
  providers: [
    AttributeService,
    AdminAttributeService,
    AdminAttributeValueService,
    AttributeEventPublisher,
    AttributeEventHandler,
  ],
  exports: [
    AttributeService,
    AdminAttributeService,
    AdminAttributeValueService,
    AttributeEventPublisher,
  ],
})
export class AttributeModule {}
