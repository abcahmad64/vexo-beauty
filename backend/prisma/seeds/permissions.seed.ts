import { PrismaClient } from '../../src/generated/prisma';

type PermissionDefinition = readonly [name: string, description: string];

const permissions = [
  ['admin:*', 'دسترسی کامل به پنل مدیریت'],
  ['admin:read', 'مشاهده بخش‌های مدیریتی'],
  ['admin:manage', 'مدیریت بخش‌های مدیریتی'],

  ['dashboard:*', 'دسترسی کامل به داشبورد مدیریت'],
  ['dashboard:read', 'مشاهده داشبورد مدیریت'],

  ['users:*', 'مدیریت کامل کاربران'],
  ['users:read', 'مشاهده کاربران'],
  ['users:manage', 'مدیریت کاربران'],

  ['products:*', 'مدیریت کامل محصولات'],
  ['products:read', 'مشاهده محصولات'],
  ['products:manage', 'مدیریت محصولات'],

  ['catalog:*', 'دسترسی کامل به کاتالوگ'],
  ['catalog:read', 'مشاهده کاتالوگ'],
  ['catalog:manage', 'مدیریت کاتالوگ'],

  ['orders:*', 'مدیریت کامل سفارش‌ها'],
  ['orders:read', 'مشاهده سفارش‌ها'],
  ['orders:manage', 'مدیریت سفارش‌ها'],
  ['order:*', 'دسترسی کامل به سفارش'],
  ['order:read', 'مشاهده سفارش'],
  ['order:manage', 'مدیریت سفارش'],
  ['sales:manage', 'مدیریت فروش و سفارش‌ها'],

  ['payments:*', 'مدیریت کامل پرداخت‌ها'],
  ['payments:read', 'مشاهده پرداخت‌ها'],
  ['payments:manage', 'مدیریت پرداخت‌ها'],
  ['payment:*', 'دسترسی کامل به پرداخت'],
  ['payment:read', 'مشاهده پرداخت'],
  ['payment:manage', 'مدیریت پرداخت'],
  ['finance:read', 'مشاهده اطلاعات مالی'],
  ['finance:manage', 'مدیریت اطلاعات مالی'],

  ['refunds:*', 'مدیریت کامل بازگشت وجه‌ها'],
  ['refunds:read', 'مشاهده بازگشت وجه‌ها'],
  ['refunds:manage', 'مدیریت بازگشت وجه‌ها'],
  ['refunds:create', 'ایجاد بازگشت وجه'],
  ['refunds:update', 'ویرایش بازگشت وجه'],
  ['refunds:delete', 'حذف بازگشت وجه'],
  ['refund:*', 'دسترسی کامل به بازگشت وجه'],
  ['refund:read', 'مشاهده بازگشت وجه'],
  ['refund:manage', 'مدیریت بازگشت وجه'],
  ['refund:create', 'ایجاد بازگشت وجه'],
  ['refund:update', 'ویرایش بازگشت وجه'],
  ['refund:delete', 'حذف بازگشت وجه'],

  ['shipments:*', 'مدیریت کامل ارسال‌ها'],
  ['shipments:read', 'مشاهده ارسال‌ها'],
  ['shipments:manage', 'مدیریت ارسال‌ها'],
  ['shipment:*', 'دسترسی کامل به ارسال'],
  ['shipment:read', 'مشاهده ارسال'],
  ['shipment:manage', 'مدیریت ارسال'],

  ['invoices:*', 'مدیریت کامل فاکتورها'],
  ['invoices:read', 'مشاهده فاکتورها'],
  ['invoices:manage', 'مدیریت فاکتورها'],

  ['notifications:*', 'مدیریت کامل اعلان‌ها'],
  ['notifications:read', 'مشاهده اعلان‌ها'],
  ['notifications:manage', 'مدیریت اعلان‌ها'],

  ['analytics:*', 'مشاهده و مدیریت گزارش‌ها'],
  ['analytics:read', 'مشاهده گزارش‌ها'],
  ['analytics:manage', 'مدیریت گزارش‌ها'],

  ['reports:*', 'دسترسی کامل به گزارش‌ها'],
  ['reports:read', 'مشاهده گزارش‌ها'],
  ['reports:manage', 'مدیریت گزارش‌ها'],

  ['search:*', 'دسترسی کامل به جستجو'],
  ['search:read', 'استفاده از جستجو'],
  ['search:manage', 'مدیریت جستجو'],

  ['queue:*', 'دسترسی کامل به صف‌ها'],
  ['queue:read', 'مشاهده وضعیت صف‌ها'],
  ['queue:manage', 'مدیریت صف‌ها'],

  ['scheduler:*', 'دسترسی کامل به زمان‌بندی‌ها'],
  ['scheduler:read', 'مشاهده زمان‌بندی‌ها'],
  ['scheduler:manage', 'مدیریت زمان‌بندی‌ها'],
  ['scheduler:run', 'اجرای دستی وظایف زمان‌بندی‌شده'],

  ['rbac:*', 'دسترسی کامل به مدیریت نقش‌ها و مجوزها'],
  ['rbac:read', 'مشاهده نقش‌ها و مجوزها'],
  ['rbac:manage', 'مدیریت نقش‌ها و مجوزها'],

  ['audit:*', 'دسترسی کامل به گزارش فعالیت‌ها'],
  ['audit:read', 'مشاهده گزارش فعالیت‌ها'],
  ['audit:manage', 'مدیریت گزارش فعالیت‌ها'],
  ['audit:create', 'ایجاد گزارش فعالیت'],
  ['audit:delete', 'حذف گزارش فعالیت'],
  ['audit:export', 'خروجی گرفتن از گزارش فعالیت‌ها'],

  ['audits:*', 'دسترسی کامل به گزارش‌های فعالیت'],
  ['audits:read', 'مشاهده گزارش‌های فعالیت'],
  ['audits:manage', 'مدیریت گزارش‌های فعالیت'],
  ['audits:export', 'خروجی گرفتن از گزارش‌های فعالیت'],

  ['activity:*', 'دسترسی کامل به فعالیت‌ها'],
  ['activity:read', 'مشاهده فعالیت‌ها'],
  ['activity:manage', 'مدیریت فعالیت‌ها'],
] satisfies readonly PermissionDefinition[];

export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  for (const [name, description] of permissions) {
    await prisma.permission.upsert({
      where: {
        name,
      },
      update: {
        description,
        deletedAt: null,
      },
      create: {
        name,
        description,
      },
    });
  }
}
