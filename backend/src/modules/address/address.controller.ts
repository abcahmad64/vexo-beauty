import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateAddressDto } from './dto/create-address.dto';
import { QueryAddressDto } from './dto/query-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressService } from './services/address.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ): Promise<unknown> {
    return this.addressService.create(this.getUserId(req), dto);
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAddressDto,
  ): Promise<unknown> {
    return this.addressService.findAllByUser(this.getUserId(req), query);
  }

  @Get('default')
  findDefault(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.addressService.findDefaultByUser(this.getUserId(req));
  }

  @Get(':addressId')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    return this.addressService.findOneByUser(this.getUserId(req), addressId);
  }

  @Patch(':addressId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<unknown> {
    return this.addressService.update(this.getUserId(req), addressId, dto);
  }

  @Patch(':addressId/default')
  setDefault(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    return this.addressService.setDefault(this.getUserId(req), addressId);
  }

  @Delete(':addressId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ): Promise<unknown> {
    return this.addressService.remove(this.getUserId(req), addressId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }
}
