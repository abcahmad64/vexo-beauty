import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacController } from './rbac.controller';

import { RbacEventHandler } from './events/rbac.event.handler';

import { RbacEventPublisher } from './events/rbac.event.publisher';

import { PermissionsGuard } from './guards/permissions.guard';

import { RbacGuard } from './guards/rbac.guard';

import { RolesGuard } from './guards/roles.guard';

import { RbacService } from './services/rbac.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    RbacEventPublisher,
    RbacEventHandler,
    RolesGuard,
    PermissionsGuard,
    RbacGuard,
  ],
  exports: [RbacService, RolesGuard, PermissionsGuard, RbacGuard],
})
export class RbacModule {}
