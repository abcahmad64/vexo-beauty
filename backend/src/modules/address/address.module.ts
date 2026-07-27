import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AddressAdminController } from './address-admin.controller';

import { AddressController } from './address.controller';

import { AddressEventHandler } from './events/address.event.handler';

import { AddressEventPublisher } from './events/address.event.publisher';

import { AdminAddressService } from './services/admin-address.service';

import { AddressService } from './services/address.service';

@Module({
  imports: [PrismaModule],
  controllers: [AddressController, AddressAdminController],
  providers: [
    AddressService,
    AdminAddressService,
    AddressEventPublisher,
    AddressEventHandler,
  ],
  exports: [AddressService, AdminAddressService, AddressEventPublisher],
})
export class AddressModule {}
