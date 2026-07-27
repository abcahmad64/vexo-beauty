import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { createReadStream, existsSync } from 'fs';

import { mkdir, stat } from 'fs/promises';

import { join } from 'path';

import puppeteer from 'puppeteer-core';

import { Prisma } from '../../../generated/prisma';

import {
  formatPersianDate,
  formatPersianDateTime,
} from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { InvoiceQueueJobData } from '../../../core/queue/types/queue.types';

import { InvoiceService } from './invoice.service';

import { renderInvoicePdfHtml } from '../templates/invoice-pdf.template';

import type {
  InvoicePdfCompanyInfo,
  InvoicePdfItem,
  InvoicePdfTemplateInput,
} from '../templates/invoice-pdf.template';

type ExistingInvoiceRow = {
  id: string;
  pdfUrl: string | null;
};

type InvoicePdfContextRow = {
  invoiceId: string;
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueDate: Date | null;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  pdfUrl: string | null;

  orderNumber: string;
  orderStatus: string;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;

  paymentStatus: string;
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: Date | null;

  userId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
};

type InvoiceItemRow = {
  productName: string;
  sku: string;
  quantity: number;
  price: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
};

export type InvoicePdfGenerationResult = {
  readonly action:
    'created_invoice_pdf' | 'regenerated_invoice_pdf' | 'skipped_existing_pdf';
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly pdfUrl: string | null;
  readonly filePath?: string;
};

export type InvoicePdfFileResult = {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly pdfUrl: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly sizeBytes: number;
};

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async generateForQueue(
    data: InvoiceQueueJobData,
  ): Promise<InvoicePdfGenerationResult> {
    const invoice = await this.resolveInvoice(data);

    if (invoice.pdfUrl && data.regenerate !== true) {
      return {
        action: 'skipped_existing_pdf',
        invoiceId: invoice.id,
        invoiceNumber: await this.findInvoiceNumber(invoice.id),
        orderId: data.orderId,
        paymentId: await this.findPaymentId(invoice.id),
        pdfUrl: invoice.pdfUrl,
      };
    }

    return this.generatePdfForInvoice(invoice.id, data.regenerate === true);
  }

  async generatePdfForInvoice(
    invoiceId: string,
    regenerate: boolean,
  ): Promise<InvoicePdfGenerationResult> {
    const context = await this.loadInvoiceContext(invoiceId);

    const items = await this.loadInvoiceItems(context.orderId);

    const fileLocation = await this.createFileLocation(context.invoiceNumber);

    const templateInput = this.buildTemplateInput(context, items);

    const html = renderInvoicePdfHtml(templateInput);

    await this.renderPdf(html, fileLocation.absolutePath);

    await this.updateInvoicePdfUrl(context.invoiceId, fileLocation.publicUrl);

    return {
      action: regenerate ? 'regenerated_invoice_pdf' : 'created_invoice_pdf',
      invoiceId: context.invoiceId,
      invoiceNumber: context.invoiceNumber,
      orderId: context.orderId,
      paymentId: context.paymentId,
      pdfUrl: fileLocation.publicUrl,
      filePath: fileLocation.absolutePath,
    };
  }

  async getOrCreatePdfFile(invoiceId: string): Promise<InvoicePdfFileResult> {
    const context = await this.loadInvoiceContext(invoiceId);

    if (context.pdfUrl) {
      const filePath = this.resolveFilePathFromPdfUrl(context.pdfUrl);

      if (existsSync(filePath)) {
        const fileStat = await stat(filePath);

        return {
          invoiceId: context.invoiceId,
          invoiceNumber: context.invoiceNumber,
          pdfUrl: context.pdfUrl,
          filePath,
          fileName: this.createDownloadFileName(context.invoiceNumber),
          sizeBytes: fileStat.size,
        };
      }
    }

    const generated = await this.generatePdfForInvoice(
      invoiceId,
      Boolean(context.pdfUrl),
    );

    if (!generated.pdfUrl || !generated.filePath) {
      throw new InternalServerErrorException(
        'تولید فایل PDF فاکتور ناموفق بود.',
      );
    }

    const fileStat = await stat(generated.filePath);

    return {
      invoiceId: generated.invoiceId,
      invoiceNumber: generated.invoiceNumber,
      pdfUrl: generated.pdfUrl,
      filePath: generated.filePath,
      fileName: this.createDownloadFileName(generated.invoiceNumber),
      sizeBytes: fileStat.size,
    };
  }

  createPdfReadStream(filePath: string) {
    return createReadStream(filePath);
  }

  private async resolveInvoice(
    data: InvoiceQueueJobData,
  ): Promise<ExistingInvoiceRow> {
    if (data.invoiceId) {
      return this.findExistingInvoiceById(data.invoiceId);
    }

    const existing = await this.findExistingInvoiceByOrderId(data.orderId);

    if (existing) {
      return existing;
    }

    const created = await this.invoiceService.createInvoice(
      {
        orderId: data.orderId,
      },
      {
        actorId: data.metadata.actorId,
      },
    );

    return {
      id: created.id,
      pdfUrl: created.pdfUrl,
    };
  }

  private async findExistingInvoiceById(
    invoiceId: string,
  ): Promise<ExistingInvoiceRow> {
    const rows = await this.prisma.$queryRaw<ExistingInvoiceRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "pdfUrl"
          FROM "Invoice"
          WHERE
            "id" = ${invoiceId}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const invoice = rows[0];

    if (!invoice) {
      throw new NotFoundException('فاکتور یافت نشد.');
    }

    return invoice;
  }

  private async findExistingInvoiceByOrderId(
    orderId: string,
  ): Promise<ExistingInvoiceRow | null> {
    const rows = await this.prisma.$queryRaw<ExistingInvoiceRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "pdfUrl"
          FROM "Invoice"
          WHERE
            "orderId" = ${orderId}
            AND "deleted_at" IS NULL
          ORDER BY
            "createdAt" DESC
          LIMIT 1
        `,
    );

    return rows[0] ?? null;
  }

  private async findInvoiceNumber(invoiceId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        invoiceNumber: string;
      }>
    >(
      Prisma.sql`
          SELECT
            "invoiceNumber"
          FROM "Invoice"
          WHERE
            "id" = ${invoiceId}
          LIMIT 1
        `,
    );

    return rows[0]?.invoiceNumber ?? invoiceId;
  }

  private async findPaymentId(invoiceId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        paymentId: string;
      }>
    >(
      Prisma.sql`
          SELECT
            "paymentId"
          FROM "Invoice"
          WHERE
            "id" = ${invoiceId}
          LIMIT 1
        `,
    );

    return rows[0]?.paymentId ?? '';
  }

  private async loadInvoiceContext(
    invoiceId: string,
  ): Promise<InvoicePdfContextRow> {
    const rows = await this.prisma.$queryRaw<InvoicePdfContextRow[]>(
      Prisma.sql`
          SELECT
            i."id" AS "invoiceId",
            i."orderId",
            i."paymentId",
            i."invoiceNumber",
            i."issuedAt",
            i."dueDate",
            i."amount",
            i."currency",
            i."status"::text AS "status",
            i."pdfUrl",

            o."orderNumber",
            o."status"::text AS "orderStatus",
            o."subtotal",
            o."taxAmount",
            o."shippingAmount",
            o."discountAmount",
            o."totalAmount",

            p."paymentStatus"::text AS "paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."paidAt",

            u."id" AS "userId",
            u."email",
            u."phone",
            u."firstName",
            u."lastName"
          FROM "Invoice" i
          INNER JOIN "Order" o
            ON o."id" = i."orderId"
          INNER JOIN "Payment" p
            ON p."id" = i."paymentId"
          INNER JOIN "User" u
            ON u."id" = o."userId"
          WHERE
            i."id" = ${invoiceId}
            AND i."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const context = rows[0];

    if (!context) {
      throw new NotFoundException(
        'اطلاعات کامل فاکتور برای تولید PDF یافت نشد.',
      );
    }

    return context;
  }

  private async loadInvoiceItems(orderId: string): Promise<InvoiceItemRow[]> {
    return this.prisma.$queryRaw<InvoiceItemRow[]>(
      Prisma.sql`
        SELECT
          oi."productName",
          oi."sku",
          oi."quantity",
          oi."price",
          oi."discount",
          ((oi."price" * oi."quantity") - oi."discount") AS "total"
        FROM "OrderItem" oi
        WHERE
          oi."orderId" = ${orderId}
        ORDER BY
          oi."createdAt" ASC
      `,
    );
  }

  private buildTemplateInput(
    context: InvoicePdfContextRow,
    items: InvoiceItemRow[],
  ): InvoicePdfTemplateInput {
    return {
      invoiceNumber: context.invoiceNumber,
      issuedAt: this.formatDate(context.issuedAt),
      dueDate: context.dueDate ? this.formatDate(context.dueDate) : null,
      amount: this.formatMoney(context.amount, context.currency),
      currency: context.currency,
      status: context.status,
      company: this.getCompanyInfo(),
      customer: {
        fullName: this.resolveCustomerName(context),
        email: context.email,
        phone: context.phone,
      },
      order: {
        orderId: context.orderId,
        orderNumber: context.orderNumber,
        status: context.orderStatus,
        subtotal: this.formatMoney(context.subtotal, context.currency),
        taxAmount: this.formatMoney(context.taxAmount, context.currency),
        shippingAmount: this.formatMoney(
          context.shippingAmount,
          context.currency,
        ),
        discountAmount: this.formatMoney(
          context.discountAmount,
          context.currency,
        ),
        totalAmount: this.formatMoney(context.totalAmount, context.currency),
      },
      payment: {
        paymentId: context.paymentId,
        status: context.paymentStatus,
        method: context.paymentMethod,
        transactionId: context.transactionId,
        paidAt: context.paidAt ? this.formatDate(context.paidAt) : null,
      },
      items: items.map((item) => this.mapItem(item, context.currency)),
      generatedAt: this.formatDateTime(new Date()),
    };
  }

  private mapItem(item: InvoiceItemRow, currency: string): InvoicePdfItem {
    return {
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      price: this.formatMoney(item.price, currency),
      discount: this.formatMoney(item.discount, currency),
      total: this.formatMoney(item.total, currency),
    };
  }

  private async createFileLocation(invoiceNumber: string): Promise<{
    absolutePath: string;
    publicUrl: string;
  }> {
    const now = new Date();

    const year = String(now.getFullYear());

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const storageRoot = this.getString(
      'INVOICE_PDF_STORAGE_ROOT',
      join(process.cwd(), 'storage', 'invoices'),
    );

    const publicBasePath = this.normalizePublicBasePath(
      this.getString('INVOICE_PDF_PUBLIC_BASE_PATH', '/invoices'),
    );

    const directory = join(storageRoot, year, month);

    await mkdir(directory, {
      recursive: true,
    });

    const safeInvoiceNumber = this.sanitizeFileName(invoiceNumber);

    const fileName = `${safeInvoiceNumber}.pdf`;

    return {
      absolutePath: join(directory, fileName),
      publicUrl: `${publicBasePath}/${year}/${month}/${fileName}`,
    };
  }

  private async renderPdf(html: string, absolutePath: string): Promise<void> {
    const browser = await puppeteer.launch({
      executablePath: this.resolveBrowserExecutablePath(),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=medium',
      ],
    });

    try {
      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
      });

      await page.evaluateHandle('document.fonts.ready');

      await page.pdf({
        path: absolutePath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
    } finally {
      await browser.close();
    }
  }

  private resolveBrowserExecutablePath(): string {
    const configuredPath = this.getString(
      'INVOICE_PDF_BROWSER_EXECUTABLE_PATH',
      '',
    );

    if (configuredPath.length > 0 && existsSync(configuredPath)) {
      return configuredPath;
    }

    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];

    const executablePath = candidates.find((candidate) =>
      existsSync(candidate),
    );

    if (!executablePath) {
      throw new Error(
        'مسیر اجرای Chrome/Edge برای تولید PDF پیدا نشد. مقدار INVOICE_PDF_BROWSER_EXECUTABLE_PATH را در env تنظیم کنید.',
      );
    }

    return executablePath;
  }

  private resolveFilePathFromPdfUrl(pdfUrl: string): string {
    const publicPath = this.extractPublicPath(pdfUrl);

    const publicBasePath = this.normalizePublicBasePath(
      this.getString('INVOICE_PDF_PUBLIC_BASE_PATH', '/invoices'),
    );

    const expectedPrefix = `${publicBasePath}/`;

    if (!publicPath.startsWith(expectedPrefix)) {
      throw new InternalServerErrorException('مسیر PDF فاکتور معتبر نیست.');
    }

    const relativePath = publicPath
      .slice(expectedPrefix.length)
      .split('/')
      .filter(Boolean);

    if (
      relativePath.length < 1 ||
      relativePath.some((segment) => segment === '..' || segment.includes('\\'))
    ) {
      throw new InternalServerErrorException('مسیر فایل PDF فاکتور امن نیست.');
    }

    const storageRoot = this.getString(
      'INVOICE_PDF_STORAGE_ROOT',
      join(process.cwd(), 'storage', 'invoices'),
    );

    return join(storageRoot, ...relativePath);
  }

  private extractPublicPath(value: string): string {
    const trimmed = value.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);

      return url.pathname;
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private createDownloadFileName(invoiceNumber: string): string {
    return `${this.sanitizeFileName(invoiceNumber)}.pdf`;
  }

  private async updateInvoicePdfUrl(
    invoiceId: string,
    pdfUrl: string,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "pdfUrl" = ${pdfUrl},
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private getCompanyInfo(): InvoicePdfCompanyInfo {
    return {
      name: this.getString('INVOICE_COMPANY_NAME', 'VEXO Beauty'),
      legalName: this.getString(
        'INVOICE_COMPANY_LEGAL_NAME',
        'فروشگاه اینترنتی وکسو بیوتی',
      ),
      phone: this.getString('INVOICE_COMPANY_PHONE', 'ثبت نشده'),
      email: this.getString(
        'INVOICE_COMPANY_EMAIL',
        'support@vexo-beauty.local',
      ),
      website: this.getString('INVOICE_COMPANY_WEBSITE', 'vexo-beauty.local'),
      address: this.getString('INVOICE_COMPANY_ADDRESS', 'ثبت نشده'),
      taxId: this.getString('INVOICE_COMPANY_TAX_ID', 'ثبت نشده'),
      economicCode: this.getString('INVOICE_COMPANY_ECONOMIC_CODE', 'ثبت نشده'),
    };
  }

  private resolveCustomerName(context: InvoicePdfContextRow): string {
    const fullName = [context.firstName, context.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();

    return fullName.length > 0 ? fullName : 'مشتری';
  }

  private formatMoney(value: Prisma.Decimal, currency: string): string {
    const number = Number(value.toString());

    const formatted = new Intl.NumberFormat('fa-IR', {
      maximumFractionDigits: 0,
    }).format(number);

    return `${formatted} ${this.translateCurrency(currency)}`;
  }

  private translateCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();

    const map: Record<string, string> = {
      IRR: 'ریال',
      IRT: 'تومان',
      USD: 'دلار',
      EUR: 'یورو',
    };

    return map[normalized] ?? currency;
  }

  private formatDate(value: Date): string {
    return formatPersianDate(value) ?? '';
  }

  private formatDateTime(value: Date): string {
    return formatPersianDateTime(value) ?? '';
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, '-');
  }

  private normalizePublicBasePath(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length < 1) {
      return '/invoices';
    }

    return trimmed.startsWith('/')
      ? trimmed.replace(/\/+$/g, '')
      : `/${trimmed.replace(/\/+$/g, '')}`;
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
