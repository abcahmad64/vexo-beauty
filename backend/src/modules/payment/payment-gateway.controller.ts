import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request, Response } from 'express';

import { InitiatePaymentDto } from './dto/initiate-payment.dto';

import { ZarinpalCallbackQueryDto } from './dto/zarinpal-callback-query.dto';

import { PaymentGatewayService } from './services/payment-gateway.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('payments/gateway')
export class PaymentGatewayController {
  constructor(private readonly paymentGatewayService: PaymentGatewayService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('initiate')
  initiate(@Req() req: AuthenticatedRequest, @Body() dto: InitiatePaymentDto) {
    return this.paymentGatewayService.initiateForUser(this.getUserId(req), dto);
  }

  @Get('zarinpal/callback')
  async zarinpalCallback(
    @Query() query: ZarinpalCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    this.applyCallbackResponseHeaders(res);

    const result =
      await this.paymentGatewayService.handleZarinpalCallback(query);

    res.redirect(303, result.redirectUrl);
  }

  private applyCallbackResponseHeaders(res: Response): void {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, max-age=0, must-revalidate',
    );

    res.setHeader('Pragma', 'no-cache');

    res.setHeader('Expires', '0');

    res.setHeader('Referrer-Policy', 'no-referrer');

    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
