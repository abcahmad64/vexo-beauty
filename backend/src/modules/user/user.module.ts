import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacModule } from '../rbac/rbac.module';

import { UserEventHandler } from './events/user.event.handler';

import { UserEventPublisher } from './events/user.event.publisher';

import { UserAdminController } from './user-admin.controller';

import { UserController } from './user.controller';

import { AdminCustomerActivityService } from './services/admin-customer-activity.service';

import { AdminCustomerProfileService } from './services/admin-customer-profile.service';

import { AdminUserService } from './services/admin-user.service';

import { UserService } from './services/user.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [UserController, UserAdminController],
  providers: [
    UserService,
    AdminUserService,
    AdminCustomerProfileService,
    AdminCustomerActivityService,
    UserEventPublisher,
    UserEventHandler,
  ],
  exports: [
    UserService,
    AdminUserService,
    AdminCustomerProfileService,
    AdminCustomerActivityService,
    UserEventPublisher,
  ],
})
export class UserModule {}
