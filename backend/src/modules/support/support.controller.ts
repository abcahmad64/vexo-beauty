import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import type { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCustomerSupportTicketDto } from './dto/create-customer-support-ticket.dto';
import { QueryCustomerSupportTicketDto } from './dto/query-customer-support-ticket.dto';
import { ReplyCustomerSupportTicketDto } from './dto/reply-customer-support-ticket.dto';
import { CustomerSupportService } from './services/customer-support.service';

@ApiTags('Support')
@ApiBearerAuth('access-token')
@RateLimit('sensitive')
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(
    private readonly customerSupportService: CustomerSupportService,
  ) {}

  @Get('tickets')
  @ApiOperation({ summary: 'دریافت تیکت‌های پشتیبانی مشتری' })
  findTickets(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryCustomerSupportTicketDto,
  ) {
    return this.customerSupportService.findTickets(
      this.getUserId(request),
      query,
    );
  }

  @Post('tickets')
  @ApiOperation({ summary: 'ثبت تیکت پشتیبانی مشتری' })
  createTicket(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCustomerSupportTicketDto,
  ) {
    return this.customerSupportService.createTicket(
      this.getUserId(request),
      dto,
    );
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'دریافت جزئیات تیکت متعلق به مشتری' })
  findTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
  ) {
    return this.customerSupportService.findTicket(
      this.getUserId(request),
      ticketId,
    );
  }

  @Post('tickets/:ticketId/messages')
  @ApiOperation({ summary: 'ثبت پاسخ مشتری در تیکت پشتیبانی' })
  replyTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: ReplyCustomerSupportTicketDto,
  ) {
    return this.customerSupportService.replyTicket(
      this.getUserId(request),
      ticketId,
      dto,
    );
  }

  @Patch('tickets/:ticketId/close')
  @ApiOperation({ summary: 'بستن تیکت پشتیبانی توسط مشتری' })
  closeTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
  ) {
    return this.customerSupportService.closeTicket(
      this.getUserId(request),
      ticketId,
    );
  }

  private getUserId(request: AuthenticatedRequest): string {
    const userId =
      request.user?.id ?? request.user?.userId ?? request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
