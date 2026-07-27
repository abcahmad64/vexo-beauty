import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError } from 'axios';

import { Prisma } from '../../../generated/prisma';

import type {
  PaymentGatewayRequestInput,
  PaymentGatewayRequestResult,
  PaymentGatewayVerifyInput,
  PaymentGatewayVerifyResult,
} from './payment-gateway.types';

type ZarinpalRequestPayload = {
  readonly merchant_id: string;
  readonly amount: number;
  readonly currency?: 'IRR' | 'IRT';
  readonly description: string;
  readonly callback_url: string;
  readonly metadata?: {
    readonly mobile?: string;
    readonly email?: string;
    readonly order_id?: string;
  };
};

type ZarinpalVerifyPayload = {
  readonly merchant_id: string;
  readonly amount: number;
  readonly currency?: 'IRR' | 'IRT';
  readonly authority: string;
};

type ZarinpalEnvelope<TData> = {
  readonly data?: TData;
  readonly errors?: unknown;
};

type ZarinpalRequestData = {
  readonly code?: number;
  readonly message?: string;
  readonly authority?: string;
  readonly fee_type?: string;
  readonly fee?: number;
};

type ZarinpalVerifyData = {
  readonly code?: number;
  readonly message?: string;
  readonly ref_id?: number | string;
  readonly card_pan?: string;
  readonly card_hash?: string;
  readonly fee_type?: string;
  readonly fee?: number;
};

@Injectable()
export class ZarinpalGateway {
  constructor(private readonly configService: ConfigService) {}

  assertConfigured(): void {
    this.getMerchantId();
    this.getRequestUrl();
    this.getStartPayUrl();
    this.getTimeoutMs();
  }

  buildPaymentUrl(authority: string): string {
    return `${this.getStartPayUrl()}/${encodeURIComponent(authority)}`;
  }

  async requestPayment(
    input: PaymentGatewayRequestInput,
  ): Promise<PaymentGatewayRequestResult> {
    const payload: ZarinpalRequestPayload = {
      merchant_id: this.getMerchantId(),
      amount: this.toGatewayAmount(input.amount),
      currency: this.resolveCurrency(input.currency),
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: {
        mobile: input.customer.phone ?? undefined,
        email: input.customer.email ?? undefined,
        order_id: input.orderNumber,
      },
    };

    try {
      const response = await axios.post<ZarinpalEnvelope<ZarinpalRequestData>>(
        this.getRequestUrl(),
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: this.getTimeoutMs(),
        },
      );

      const data = response.data.data;

      if (!data || data.code !== 100 || !data.authority) {
        throw new BadRequestException(
          this.extractGatewayError(
            response.data.errors,
            data?.message ?? 'درخواست پرداخت زرین‌پال ناموفق بود.',
          ),
        );
      }

      return {
        provider: 'zarinpal',
        authority: data.authority,
        paymentUrl: this.buildPaymentUrl(data.authority),
        rawResponse: this.toRecord(response.data),
      };
    } catch (error) {
      this.throwNormalizedError(error);
    }
  }

  async verifyPayment(
    input: PaymentGatewayVerifyInput,
  ): Promise<PaymentGatewayVerifyResult> {
    const payload: ZarinpalVerifyPayload = {
      merchant_id: this.getMerchantId(),
      amount: this.toGatewayAmount(input.amount),
      currency: this.resolveCurrency(input.currency),
      authority: input.authority,
    };

    try {
      const response = await axios.post<ZarinpalEnvelope<ZarinpalVerifyData>>(
        this.getVerifyUrl(),
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: this.getTimeoutMs(),
        },
      );

      const data = response.data.data;

      const code = data?.code ?? 0;

      const verified = code === 100 || code === 101;

      return {
        provider: 'zarinpal',
        verified,
        code,
        message:
          data?.message ??
          this.extractGatewayError(
            response.data.errors,
            verified
              ? 'پرداخت با موفقیت تأیید شد.'
              : 'تأیید پرداخت زرین‌پال ناموفق بود.',
          ),
        refId:
          data?.ref_id !== undefined && data.ref_id !== null
            ? String(data.ref_id)
            : null,
        cardPan: data?.card_pan ?? null,
        cardHash: data?.card_hash ?? null,
        fee: typeof data?.fee === 'number' ? data.fee : null,
        rawResponse: this.toRecord(response.data),
      };
    } catch (error) {
      this.throwNormalizedError(error);
    }
  }

  private getMerchantId(): string {
    const merchantId = this.getString('ZARINPAL_MERCHANT_ID', '');

    if (merchantId.length < 1) {
      throw new ServiceUnavailableException(
        'مرچنت کد زرین‌پال تنظیم نشده است.',
      );
    }

    return merchantId;
  }

  private getRequestUrl(): string {
    return this.getString(
      'ZARINPAL_REQUEST_URL',
      this.isSandbox()
        ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
        : 'https://payment.zarinpal.com/pg/v4/payment/request.json',
    );
  }

  private getVerifyUrl(): string {
    return this.getString(
      'ZARINPAL_VERIFY_URL',
      this.isSandbox()
        ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
        : 'https://payment.zarinpal.com/pg/v4/payment/verify.json',
    );
  }

  private getStartPayUrl(): string {
    return this.getString(
      'ZARINPAL_START_PAY_URL',
      this.isSandbox()
        ? 'https://sandbox.zarinpal.com/pg/StartPay'
        : 'https://payment.zarinpal.com/pg/StartPay',
    ).replace(/\/+$/g, '');
  }

  private isSandbox(): boolean {
    return this.getBoolean('ZARINPAL_SANDBOX', false);
  }

  private getTimeoutMs(): number {
    return this.getNumber('ZARINPAL_HTTP_TIMEOUT_MS', 15_000);
  }

  private resolveCurrency(currency: string): 'IRR' | 'IRT' | undefined {
    const normalized = currency.trim().toUpperCase();

    if (normalized === 'IRR' || normalized === 'IRT') {
      return normalized;
    }

    throw new BadRequestException(
      'واحد پولی برای زرین‌پال باید IRR یا IRT باشد.',
    );
  }

  private toGatewayAmount(value: string): number {
    const decimal = new Prisma.Decimal(value);

    if (decimal.lessThanOrEqualTo(0) || !decimal.isInteger()) {
      throw new BadRequestException(
        'مبلغ پرداخت برای زرین‌پال باید عدد صحیح و بزرگ‌تر از صفر باشد.',
      );
    }

    return decimal.toNumber();
  }

  private throwNormalizedError(error: unknown): never {
    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    if (this.isAxiosError(error)) {
      const status = error.response?.status;

      if (typeof status === 'number' && status >= 400 && status < 500) {
        const responseData = this.toRecord(error.response?.data ?? {});

        throw new BadRequestException(
          this.extractGatewayError(responseData.errors, error.message),
        );
      }

      throw new ServiceUnavailableException(
        'پاسخ قطعی از زرین‌پال دریافت نشد؛ برای جلوگیری از پرداخت تکراری درخواست جدید ایجاد نمی‌شود.',
      );
    }

    throw new ServiceUnavailableException(
      error instanceof Error
        ? error.message
        : 'وضعیت ارتباط با زرین‌پال مشخص نشد.',
    );
  }

  private isAxiosError(error: unknown): error is AxiosError<unknown> {
    return axios.isAxiosError(error);
  }

  private extractGatewayError(errors: unknown, fallback: string): string {
    if (!errors) {
      return fallback;
    }

    if (typeof errors === 'string') {
      return errors;
    }

    if (Array.isArray(errors)) {
      const first: unknown = errors[0];

      return typeof first === 'string'
        ? first
        : JSON.stringify(first ?? errors);
    }

    if (typeof errors === 'object') {
      const record = errors as Record<string, unknown>;

      const message = record.message ?? record.code ?? record.validation;

      return typeof message === 'string' ? message : JSON.stringify(record);
    }

    return fallback;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {
      value,
    };
  }

  private getString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | boolean>(key);

    if (value === undefined || value === null) {
      return fallback;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : fallback;
  }

  private getBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string | boolean>(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private getNumber(key: string, fallback: number): number {
    const value = this.configService.get<string | number>(key);

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
