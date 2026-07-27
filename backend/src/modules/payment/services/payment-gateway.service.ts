import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { InitiatePaymentDto } from '../dto/initiate-payment.dto';

import { ZarinpalCallbackQueryDto } from '../dto/zarinpal-callback-query.dto';

import { ZarinpalGateway } from '../gateways/zarinpal.gateway';

import type { PaymentGatewayVerifyResult } from '../gateways/payment-gateway.types';

import { PaymentService } from './payment.service';

import type { GatewayPaymentReservation } from './payment.service';

type GatewayPaymentRow = {
  id: string;
  orderId: string;
  userId: string;
  amount: unknown;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  gateway: string | null;
  metadata: unknown;
  orderNumber: string;
  email: string | null;
  phone: string | null;
};

type InitiatePaymentResult = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  provider: 'zarinpal';
  authority: string;
  paymentUrl: string;
  amount: string;
  currency: string;
};

type PaymentGatewayCallbackResult = {
  success: boolean;
  paymentId: string | null;
  orderId: string | null;
  provider: 'zarinpal';
  authority: string;
  refId: string | null;
  message: string;
  redirectUrl: string;
};

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly zarinpalGateway: ZarinpalGateway,
  ) {}

  async initiateForUser(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResult> {
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.ZARINPAL;

    if (paymentMethod !== PaymentMethod.ZARINPAL) {
      throw new BadRequestException(
        'در این مرحله فقط درگاه زرین‌پال برای پرداخت آنلاین فعال است.',
      );
    }

    const callbackUrl = this.getZarinpalCallbackUrl();

    this.zarinpalGateway.assertConfigured();

    const payment = await this.paymentService.reserveZarinpalPaymentForUser(
      userId,
      dto.orderId,
      userId,
    );

    if (!payment.created) {
      return this.resolveExistingInitiation(payment);
    }

    if (!payment.requestKey) {
      throw new ServiceUnavailableException(
        'کلید داخلی درخواست پرداخت ایجاد نشد.',
      );
    }

    let requestResult: Awaited<ReturnType<ZarinpalGateway['requestPayment']>>;

    try {
      requestResult = await this.zarinpalGateway.requestPayment({
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        orderNumber: payment.orderNumber,
        amount: payment.amount,
        currency: payment.currency,
        description: `پرداخت سفارش ${payment.orderNumber}`,
        callbackUrl,
        customer: {
          email: payment.email,
          phone: payment.phone,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.paymentService.markZarinpalRequestFailed(
          payment.paymentId,
          payment.requestKey,
          error.message,
          userId,
        );
      } else {
        await this.paymentService.markZarinpalRequestUnknown(
          payment.paymentId,
          payment.requestKey,
          error instanceof Error
            ? error.message
            : 'وضعیت پاسخ زرین‌پال مشخص نشد.',
        );
      }

      throw error;
    }

    let readyPayment: GatewayPaymentReservation;

    try {
      readyPayment = await this.paymentService.markZarinpalRequestReady(
        payment.paymentId,
        payment.requestKey,
        requestResult.authority,
        requestResult.rawResponse,
      );
    } catch {
      await this.paymentService.markZarinpalRequestUnknown(
        payment.paymentId,
        payment.requestKey,
        'شناسه درگاه دریافت شد اما ذخیره‌سازی نهایی آن ناموفق بود.',
      );

      throw new ServiceUnavailableException(
        'وضعیت درخواست پرداخت نیازمند بررسی است؛ برای جلوگیری از ایجاد پرداخت تکراری دوباره تلاش نشد.',
      );
    }

    return this.buildInitiatePaymentResult(
      readyPayment,
      requestResult.authority,
      requestResult.paymentUrl,
    );
  }

  private resolveExistingInitiation(
    payment: GatewayPaymentReservation,
  ): InitiatePaymentResult {
    if (payment.requestState === 'READY' && payment.authority) {
      return this.buildInitiatePaymentResult(
        payment,
        payment.authority,
        this.zarinpalGateway.buildPaymentUrl(payment.authority),
      );
    }

    if (payment.requestState === 'REQUESTING') {
      throw new ConflictException(
        'درخواست پرداخت این سفارش در حال آماده‌سازی است؛ پرداخت جدیدی ایجاد نشد.',
      );
    }

    if (payment.requestState === 'UNKNOWN') {
      throw new ConflictException(
        'وضعیت درخواست قبلی زرین‌پال نامشخص است؛ برای جلوگیری از پرداخت تکراری درخواست جدید ایجاد نشد.',
      );
    }

    throw new ConflictException(
      'برای این سفارش یک پرداخت زرین‌پال در انتظار وجود دارد و درخواست جدید ایجاد نشد.',
    );
  }

  private buildInitiatePaymentResult(
    payment: GatewayPaymentReservation,
    authority: string,
    paymentUrl: string,
  ): InitiatePaymentResult {
    return {
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      orderNumber: payment.orderNumber,
      provider: 'zarinpal',
      authority,
      paymentUrl,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  async handleZarinpalCallback(
    dto: ZarinpalCallbackQueryDto,
  ): Promise<PaymentGatewayCallbackResult> {
    let payment: GatewayPaymentRow | null = null;

    try {
      payment = await this.findGatewayPaymentByAuthority(dto.Authority);

      return await this.processZarinpalCallback(payment, dto);
    } catch (error) {
      return this.buildCallbackErrorResult(payment, dto.Authority, error);
    }
  }

  private async processZarinpalCallback(
    payment: GatewayPaymentRow,
    dto: ZarinpalCallbackQueryDto,
  ): Promise<PaymentGatewayCallbackResult> {
    if (dto.Status !== 'OK') {
      return this.handleCancelledCallback(payment, dto.Authority);
    }

    if (payment.paymentStatus === PaymentStatus.COMPLETED) {
      return {
        success: true,
        paymentId: payment.id,
        orderId: payment.orderId,
        provider: 'zarinpal',
        authority: dto.Authority,
        refId: payment.transactionId,
        message: 'پرداخت قبلاً با موفقیت ثبت شده است.',
        redirectUrl: this.buildRedirectUrl(
          true,
          payment.id,
          payment.orderId,
          'already_verified',
        ),
      };
    }

    const verifyResult = await this.zarinpalGateway.verifyPayment({
      authority: dto.Authority,
      amount: this.toDecimalString(payment.amount),
      currency: payment.currency,
    });

    if (!verifyResult.verified) {
      await this.failPaymentFromGateway(payment, dto.Authority, verifyResult);

      return {
        success: false,
        paymentId: payment.id,
        orderId: payment.orderId,
        provider: 'zarinpal',
        authority: dto.Authority,
        refId: verifyResult.refId,
        message: verifyResult.message,
        redirectUrl: this.buildRedirectUrl(
          false,
          payment.id,
          payment.orderId,
          'verify_failed',
        ),
      };
    }

    const refId = verifyResult.refId ?? dto.Authority;

    await this.paymentService.complete(
      payment.id,
      {
        transactionId: refId,
        gateway: 'zarinpal',
        receiptUrl: this.buildReceiptUrl(refId),
        paidAt: new Date().toISOString(),
        metadata: {
          zarinpal: {
            authority: dto.Authority,
            refId: verifyResult.refId,
            cardPan: verifyResult.cardPan,
            cardHash: verifyResult.cardHash,
            fee: verifyResult.fee,
            code: verifyResult.code,
            message: verifyResult.message,
            verifiedAt: new Date().toISOString(),
            response: verifyResult.rawResponse,
          },
        },
      },
      'zarinpal-callback',
    );

    return {
      success: true,
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: 'zarinpal',
      authority: dto.Authority,
      refId: verifyResult.refId,
      message: 'پرداخت با موفقیت تأیید شد.',
      redirectUrl: this.buildRedirectUrl(
        true,
        payment.id,
        payment.orderId,
        'success',
      ),
    };
  }

  private buildCallbackErrorResult(
    payment: GatewayPaymentRow | null,
    authority: string,
    error: unknown,
  ): PaymentGatewayCallbackResult {
    const status = payment ? 'processing_error' : 'invalid_callback';

    if (payment) {
      this.logger.error(
        `Zarinpal callback processing failed for payment ${payment.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } else {
      this.logger.warn('Rejected an unmatched Zarinpal callback.');
    }

    return {
      success: false,
      paymentId: payment?.id ?? null,
      orderId: payment?.orderId ?? null,
      provider: 'zarinpal',
      authority,
      refId: null,
      message: payment
        ? 'نتیجه پرداخت نیازمند بررسی مجدد است.'
        : 'اطلاعات بازگشت درگاه با پرداخت ثبت‌شده تطبیق نداشت.',
      redirectUrl: this.buildRedirectUrl(
        false,
        payment?.id ?? null,
        payment?.orderId ?? null,
        status,
      ),
    };
  }

  private async handleCancelledCallback(
    payment: GatewayPaymentRow,
    authority: string,
  ): Promise<PaymentGatewayCallbackResult> {
    if (payment.paymentStatus === PaymentStatus.PENDING) {
      await this.paymentService.fail(
        payment.id,
        {
          reason: 'پرداخت توسط کاربر لغو شد یا درگاه وضعیت ناموفق برگرداند.',
          transactionId: authority,
          gateway: 'zarinpal',
          metadata: {
            zarinpal: {
              authority,
              status: 'NOK',
              failedAt: new Date().toISOString(),
            },
          },
        },
        'zarinpal-callback',
      );
    }

    return {
      success: false,
      paymentId: payment.id,
      orderId: payment.orderId,
      provider: 'zarinpal',
      authority,
      refId: null,
      message: 'پرداخت ناموفق یا لغوشده است.',
      redirectUrl: this.buildRedirectUrl(
        false,
        payment.id,
        payment.orderId,
        'cancelled',
      ),
    };
  }

  private async failPaymentFromGateway(
    payment: GatewayPaymentRow,
    authority: string,
    verifyResult: PaymentGatewayVerifyResult,
  ): Promise<void> {
    if (payment.paymentStatus !== PaymentStatus.PENDING) {
      return;
    }

    await this.paymentService.fail(
      payment.id,
      {
        reason: verifyResult.message,
        transactionId: authority,
        gateway: 'zarinpal',
        metadata: {
          zarinpal: {
            authority,
            code: verifyResult.code,
            message: verifyResult.message,
            response: verifyResult.rawResponse,
            failedAt: new Date().toISOString(),
          },
        },
      },
      'zarinpal-callback',
    );
  }

  private async findGatewayPaymentByAuthority(
    authority: string,
  ): Promise<GatewayPaymentRow> {
    const rows = await this.prisma.$queryRaw<GatewayPaymentRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId",
            p."userId",
            p."amount",
            p."currency",
            p."paymentStatus",
            p."paymentMethod",
            p."transactionId",
            p."gateway",
            p."metadata",
            o."orderNumber",
            u."email",
            u."phone"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          INNER JOIN "User" u
            ON u."id" = p."userId"
          WHERE
            p."gateway" = 'zarinpal'
            AND p."deleted_at" IS NULL
            AND (
              p."gatewayAuthority" = ${authority}
              OR p."transactionId" = ${authority}
              OR p."metadata" #>> '{zarinpal,authority}' = ${authority}
            )
          ORDER BY
            p."createdAt" DESC
          LIMIT 1
        `,
    );

    return this.requirePayment(rows);
  }

  private requirePayment(rows: GatewayPaymentRow[]): GatewayPaymentRow {
    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('پرداخت یافت نشد.');
    }

    return payment;
  }

  private getZarinpalCallbackUrl(): string {
    const callbackUrl = this.getFirstString(
      ['PAYMENT_CALLBACK_URL', 'ZARINPAL_CALLBACK_URL'],
      '',
    );

    if (callbackUrl.length < 1) {
      throw new BadRequestException('آدرس Callback زرین‌پال تنظیم نشده است.');
    }

    return callbackUrl;
  }

  private buildReceiptUrl(refId: string): string {
    const baseUrl = this.getString('PAYMENT_RECEIPT_BASE_URL', '');

    if (baseUrl.length < 1) {
      return '';
    }

    return `${baseUrl.replace(/\/+$/g, '')}/${encodeURIComponent(refId)}`;
  }

  private buildRedirectUrl(
    success: boolean,
    paymentId: string | null,
    orderId: string | null,
    status: string,
  ): string {
    const frontendUrl = this.getString(
      'FRONTEND_URL',
      'http://localhost:3000',
    ).replace(/\/+$/g, '');

    const baseUrl = this.getString(
      success ? 'PAYMENT_SUCCESS_REDIRECT_URL' : 'PAYMENT_FAILURE_REDIRECT_URL',
      success
        ? `${frontendUrl}/payment/success`
        : `${frontendUrl}/payment/failure`,
    );

    const url = new URL(baseUrl);

    if (paymentId) {
      url.searchParams.set('paymentId', paymentId);
    }

    if (orderId) {
      url.searchParams.set('orderId', orderId);
    }

    url.searchParams.set('status', status);

    return url.toString();
  }

  private toDecimalString(value: unknown): string {
    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      try {
        return new Prisma.Decimal(value.toString()).toString();
      } catch {
        throw new ServiceUnavailableException(
          'مبلغ ثبت‌شده پرداخت معتبر نیست.',
        );
      }
    }

    throw new ServiceUnavailableException('مبلغ ثبت‌شده پرداخت معتبر نیست.');
  }

  private getFirstString(keys: string[], fallback: string): string {
    for (const key of keys) {
      const value = this.getString(key, '');

      if (value.length > 0) {
        return value;
      }
    }

    return fallback;
  }

  private getString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | boolean>(key);

    if (value === undefined || value === null) {
      return fallback;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : fallback;
  }
}
