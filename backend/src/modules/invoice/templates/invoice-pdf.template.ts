export type InvoicePdfCompanyInfo = {
  readonly name: string;
  readonly legalName: string;
  readonly phone: string;
  readonly email: string;
  readonly website: string;
  readonly address: string;
  readonly taxId: string;
  readonly economicCode: string;
};

export type InvoicePdfCustomerInfo = {
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
};

export type InvoicePdfOrderInfo = {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly subtotal: string;
  readonly taxAmount: string;
  readonly shippingAmount: string;
  readonly discountAmount: string;
  readonly totalAmount: string;
};

export type InvoicePdfPaymentInfo = {
  readonly paymentId: string;
  readonly status: string;
  readonly method: string | null;
  readonly transactionId: string | null;
  readonly paidAt: string | null;
};

export type InvoicePdfItem = {
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly price: string;
  readonly discount: string;
  readonly total: string;
};

export type InvoicePdfTemplateInput = {
  readonly invoiceNumber: string;
  readonly issuedAt: string;
  readonly dueDate: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly status: string;
  readonly company: InvoicePdfCompanyInfo;
  readonly customer: InvoicePdfCustomerInfo;
  readonly order: InvoicePdfOrderInfo;
  readonly payment: InvoicePdfPaymentInfo;
  readonly items: readonly InvoicePdfItem[];
  readonly generatedAt: string;
};

export function renderInvoicePdfHtml(input: InvoicePdfTemplateInput): string {
  const itemsHtml =
    input.items.length > 0
      ? input.items
          .map((item, index) =>
            [
              '<tr>',
              `<td>${toPersianDigits(index + 1)}</td>`,
              `<td class="text-right">${escapeHtml(item.productName)}</td>`,
              `<td>${escapeHtml(item.sku)}</td>`,
              `<td>${toPersianDigits(item.quantity)}</td>`,
              `<td>${escapeHtml(item.price)}</td>`,
              `<td>${escapeHtml(item.discount)}</td>`,
              `<td>${escapeHtml(item.total)}</td>`,
              '</tr>',
            ].join(''),
          )
          .join('')
      : [
          '<tr>',
          '<td colspan="7" class="empty">آیتمی برای این فاکتور ثبت نشده است.</td>',
          '</tr>',
        ].join('');

  return [
    '<!doctype html>',
    '<html lang="fa" dir="rtl">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>فاکتور فروش</title>',
    '<style>',
    '* { box-sizing: border-box; }',
    'body { margin: 0; padding: 0; background: #f3f4f6; color: #111827; font-family: Tahoma, Arial, sans-serif; direction: rtl; }',
    '.page { width: 210mm; min-height: 297mm; padding: 16mm; margin: 0 auto; background: #ffffff; }',
    '.header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }',
    '.brand h1 { margin: 0; font-size: 26px; font-weight: 800; }',
    '.brand p { margin: 6px 0 0; color: #4b5563; font-size: 12px; line-height: 1.8; }',
    '.invoice-box { min-width: 230px; border: 1px solid #d1d5db; border-radius: 14px; padding: 14px; background: #f9fafb; }',
    '.invoice-box h2 { margin: 0 0 10px; font-size: 18px; }',
    '.meta-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 12px; }',
    '.meta-row span:first-child { color: #6b7280; }',
    '.section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }',
    '.card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; }',
    '.card h3 { margin: 0 0 12px; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }',
    '.info-line { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; padding: 5px 0; }',
    '.info-line .label { color: #6b7280; white-space: nowrap; }',
    '.info-line .value { text-align: left; direction: ltr; }',
    '.info-line .value-fa { text-align: right; direction: rtl; }',
    'table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }',
    'th { background: #111827; color: #ffffff; padding: 10px 8px; border: 1px solid #111827; font-weight: 700; }',
    'td { padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center; }',
    'tr:nth-child(even) td { background: #f9fafb; }',
    '.text-right { text-align: right; }',
    '.empty { color: #6b7280; padding: 22px; }',
    '.summary { width: 45%; margin-right: auto; margin-top: 18px; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }',
    '.summary-row { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }',
    '.summary-row:last-child { border-bottom: 0; }',
    '.summary-row.total { background: #111827; color: #ffffff; font-size: 15px; font-weight: 800; }',
    '.footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; line-height: 1.9; }',
    '.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 34px; }',
    '.signature { height: 74px; border: 1px dashed #d1d5db; border-radius: 14px; padding: 12px; color: #6b7280; font-size: 12px; }',
    '@page { size: A4; margin: 0; }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="page">',
    '<section class="header">',
    '<div class="brand">',
    `<h1>${escapeHtml(input.company.name)}</h1>`,
    `<p>${escapeHtml(input.company.legalName)}</p>`,
    `<p>${escapeHtml(input.company.address)}</p>`,
    `<p>تلفن: ${escapeHtml(input.company.phone)} | ایمیل: ${escapeHtml(input.company.email)} | وب‌سایت: ${escapeHtml(input.company.website)}</p>`,
    '</div>',
    '<div class="invoice-box">',
    '<h2>فاکتور فروش</h2>',
    metaRow('شماره فاکتور', input.invoiceNumber),
    metaRow('تاریخ صدور', input.issuedAt),
    metaRow('تاریخ سررسید', input.dueDate ?? 'ندارد'),
    metaRow('وضعیت', translateInvoiceStatus(input.status)),
    '</div>',
    '</section>',
    '<section class="section-grid">',
    '<div class="card">',
    '<h3>مشخصات خریدار</h3>',
    infoRow('نام مشتری', input.customer.fullName, true),
    infoRow('ایمیل', input.customer.email ?? 'ثبت نشده', false),
    infoRow('موبایل', input.customer.phone ?? 'ثبت نشده', false),
    '</div>',
    '<div class="card">',
    '<h3>مشخصات سفارش و پرداخت</h3>',
    infoRow('شماره سفارش', input.order.orderNumber, false),
    infoRow('وضعیت سفارش', translateOrderStatus(input.order.status), true),
    infoRow('روش پرداخت', input.payment.method ?? 'ثبت نشده', true),
    infoRow('کد تراکنش', input.payment.transactionId ?? 'ثبت نشده', false),
    infoRow('تاریخ پرداخت', input.payment.paidAt ?? 'ثبت نشده', false),
    '</div>',
    '</section>',
    '<table>',
    '<thead>',
    '<tr>',
    '<th>ردیف</th>',
    '<th>نام محصول</th>',
    '<th>SKU</th>',
    '<th>تعداد</th>',
    '<th>قیمت واحد</th>',
    '<th>تخفیف</th>',
    '<th>جمع</th>',
    '</tr>',
    '</thead>',
    `<tbody>${itemsHtml}</tbody>`,
    '</table>',
    '<section class="summary">',
    summaryRow('جمع جزء', input.order.subtotal),
    summaryRow('مالیات', input.order.taxAmount),
    summaryRow('هزینه ارسال', input.order.shippingAmount),
    summaryRow('تخفیف', input.order.discountAmount),
    summaryRow('مبلغ نهایی', input.amount, true),
    '</section>',
    '<section class="signatures">',
    '<div class="signature">امضای فروشنده</div>',
    '<div class="signature">امضای خریدار</div>',
    '</section>',
    '<footer class="footer">',
    `<p>شناسه مالیاتی: ${escapeHtml(input.company.taxId)} | کد اقتصادی: ${escapeHtml(input.company.economicCode)}</p>`,
    `<p>این فاکتور به‌صورت سیستمی در تاریخ ${escapeHtml(input.generatedAt)} تولید شده است.</p>`,
    '</footer>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

function metaRow(label: string, value: string): string {
  return [
    '<div class="meta-row">',
    `<span>${escapeHtml(label)}</span>`,
    `<strong>${escapeHtml(value)}</strong>`,
    '</div>',
  ].join('');
}

function infoRow(label: string, value: string, rtl: boolean): string {
  return [
    '<div class="info-line">',
    `<span class="label">${escapeHtml(label)}</span>`,
    `<span class="${rtl ? 'value-fa' : 'value'}">${escapeHtml(value)}</span>`,
    '</div>',
  ].join('');
}

function summaryRow(label: string, value: string, total = false): string {
  return [
    `<div class="summary-row${total ? ' total' : ''}">`,
    `<span>${escapeHtml(label)}</span>`,
    `<strong>${escapeHtml(value)}</strong>`,
    '</div>',
  ].join('');
}

function translateInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    PAID: 'پرداخت‌شده',
    PENDING: 'در انتظار پرداخت',
    OVERDUE: 'سررسید گذشته',
    CANCELLED: 'لغوشده',
  };

  return map[status] ?? status;
}

function translateOrderStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'در انتظار بررسی',
    CONFIRMED: 'تأییدشده',
    PROCESSING: 'در حال پردازش',
    SHIPPED: 'ارسال‌شده',
    DELIVERED: 'تحویل‌شده',
    CANCELLED: 'لغوشده',
    REFUNDED: 'مرجوع‌شده',
  };

  return map[status] ?? status;
}

function toPersianDigits(value: string | number): string {
  return String(value).replace(
    /\d/g,
    (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
