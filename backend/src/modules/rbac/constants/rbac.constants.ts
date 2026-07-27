export const RBAC_ROLES_KEY = 'rbac:roles';

export const RBAC_PERMISSIONS_KEY = 'rbac:permissions';

export const RBAC_ANY_PERMISSIONS_KEY = 'rbac:any-permissions';

export const SystemRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type SystemRole = (typeof SystemRoles)[keyof typeof SystemRoles];

export type DefaultPermissionDefinition = {
  readonly name: string;
  readonly description: string;
};

export const DefaultPermissionDefinitions = [
  {
    name: 'admin:*',
    description: 'دسترسی کامل به پنل مدیریت',
  },
  {
    name: 'admin:read',
    description: 'مشاهده بخش‌های مدیریتی',
  },
  {
    name: 'admin:manage',
    description: 'مدیریت بخش‌های مدیریتی',
  },

  {
    name: 'dashboard:*',
    description: 'دسترسی کامل به داشبورد مدیریت',
  },
  {
    name: 'dashboard:read',
    description: 'مشاهده داشبورد مدیریت',
  },
  {
    name: 'dashboard:manage',
    description: 'مدیریت داشبورد مدیریت',
  },

  {
    name: 'users:*',
    description: 'مدیریت کامل کاربران',
  },
  {
    name: 'users:read',
    description: 'مشاهده کاربران',
  },
  {
    name: 'users:manage',
    description: 'مدیریت کاربران',
  },

  {
    name: 'products:*',
    description: 'مدیریت کامل محصولات',
  },
  {
    name: 'products:read',
    description: 'مشاهده محصولات',
  },
  {
    name: 'products:manage',
    description: 'مدیریت محصولات',
  },

  {
    name: 'catalog:*',
    description: 'دسترسی کامل به کاتالوگ',
  },
  {
    name: 'catalog:read',
    description: 'مشاهده کاتالوگ',
  },
  {
    name: 'catalog:manage',
    description: 'مدیریت کاتالوگ',
  },

  {
    name: 'categories:*',
    description: 'دسترسی کامل به دسته‌بندی‌ها',
  },
  {
    name: 'categories:read',
    description: 'مشاهده دسته‌بندی‌ها',
  },
  {
    name: 'categories:manage',
    description: 'مدیریت دسته‌بندی‌ها',
  },

  {
    name: 'brands:*',
    description: 'دسترسی کامل به برندها',
  },
  {
    name: 'brands:read',
    description: 'مشاهده برندها',
  },
  {
    name: 'brands:manage',
    description: 'مدیریت برندها',
  },

  {
    name: 'attributes:*',
    description: 'دسترسی کامل به ویژگی‌های محصول',
  },
  {
    name: 'attributes:read',
    description: 'مشاهده ویژگی‌های محصول',
  },
  {
    name: 'attributes:manage',
    description: 'مدیریت ویژگی‌های محصول',
  },

  {
    name: 'collections:*',
    description: 'دسترسی کامل به کالکشن‌ها',
  },
  {
    name: 'collections:read',
    description: 'مشاهده کالکشن‌ها',
  },
  {
    name: 'collections:manage',
    description: 'مدیریت کالکشن‌ها',
  },

  {
    name: 'homepage:*',
    description: 'دسترسی کامل به مدیریت صفحه اصلی',
  },
  {
    name: 'homepage:read',
    description: 'مشاهده مدیریت صفحه اصلی',
  },
  {
    name: 'homepage:manage',
    description: 'مدیریت صفحه اصلی',
  },

  {
    name: 'media:*',
    description: 'دسترسی کامل به رسانه‌ها',
  },
  {
    name: 'media:read',
    description: 'مشاهده رسانه‌ها',
  },
  {
    name: 'media:manage',
    description: 'مدیریت رسانه‌ها',
  },
  {
    name: 'media:upload',
    description: 'آپلود رسانه',
  },
  {
    name: 'media:update',
    description: 'به‌روزرسانی رسانه',
  },
  {
    name: 'media:delete',
    description: 'حذف رسانه',
  },
  {
    name: 'upload:*',
    description: 'دسترسی کامل به آپلود فایل',
  },
  {
    name: 'upload:read',
    description: 'مشاهده فایل‌های آپلودشده',
  },
  {
    name: 'upload:manage',
    description: 'مدیریت آپلود فایل',
  },

  {
    name: 'inventory:*',
    description: 'دسترسی کامل به موجودی',
  },
  {
    name: 'inventory:read',
    description: 'مشاهده موجودی',
  },
  {
    name: 'inventory:manage',
    description: 'مدیریت موجودی',
  },

  {
    name: 'warehouses:*',
    description: 'دسترسی کامل به انبارها',
  },
  {
    name: 'warehouses:read',
    description: 'مشاهده انبارها',
  },
  {
    name: 'warehouses:manage',
    description: 'مدیریت انبارها',
  },

  {
    name: 'orders:*',
    description: 'مدیریت کامل سفارش‌ها',
  },
  {
    name: 'orders:read',
    description: 'مشاهده سفارش‌ها',
  },
  {
    name: 'orders:manage',
    description: 'مدیریت سفارش‌ها',
  },
  {
    name: 'order:*',
    description: 'دسترسی کامل به سفارش',
  },
  {
    name: 'order:read',
    description: 'مشاهده سفارش',
  },
  {
    name: 'order:manage',
    description: 'مدیریت سفارش',
  },
  {
    name: 'sales:manage',
    description: 'مدیریت فروش و سفارش‌ها',
  },

  {
    name: 'payments:*',
    description: 'مدیریت کامل پرداخت‌ها',
  },
  {
    name: 'payments:read',
    description: 'مشاهده پرداخت‌ها',
  },
  {
    name: 'payments:manage',
    description: 'مدیریت پرداخت‌ها',
  },
  {
    name: 'payment:*',
    description: 'دسترسی کامل به پرداخت',
  },
  {
    name: 'payment:read',
    description: 'مشاهده پرداخت',
  },
  {
    name: 'payment:manage',
    description: 'مدیریت پرداخت',
  },
  {
    name: 'finance:read',
    description: 'مشاهده اطلاعات مالی',
  },
  {
    name: 'finance:manage',
    description: 'مدیریت اطلاعات مالی',
  },

  {
    name: 'refunds:*',
    description: 'مدیریت کامل بازگشت وجه‌ها',
  },
  {
    name: 'refunds:read',
    description: 'مشاهده بازگشت وجه‌ها',
  },
  {
    name: 'refunds:manage',
    description: 'مدیریت بازگشت وجه‌ها',
  },
  {
    name: 'refunds:create',
    description: 'ایجاد بازگشت وجه',
  },
  {
    name: 'refunds:update',
    description: 'ویرایش بازگشت وجه',
  },
  {
    name: 'refunds:delete',
    description: 'حذف بازگشت وجه',
  },
  {
    name: 'refund:*',
    description: 'دسترسی کامل به بازگشت وجه',
  },
  {
    name: 'refund:read',
    description: 'مشاهده بازگشت وجه',
  },
  {
    name: 'refund:manage',
    description: 'مدیریت بازگشت وجه',
  },

  {
    name: 'shipments:*',
    description: 'مدیریت کامل ارسال‌ها',
  },
  {
    name: 'shipments:read',
    description: 'مشاهده ارسال‌ها',
  },
  {
    name: 'shipments:manage',
    description: 'مدیریت ارسال‌ها',
  },
  {
    name: 'shipment:*',
    description: 'دسترسی کامل به ارسال',
  },
  {
    name: 'shipment:read',
    description: 'مشاهده ارسال',
  },
  {
    name: 'shipment:manage',
    description: 'مدیریت ارسال',
  },

  {
    name: 'invoices:*',
    description: 'مدیریت کامل فاکتورها',
  },
  {
    name: 'invoices:read',
    description: 'مشاهده فاکتورها',
  },
  {
    name: 'invoices:manage',
    description: 'مدیریت فاکتورها',
  },

  {
    name: 'coupons:*',
    description: 'مدیریت کامل کوپن‌ها',
  },
  {
    name: 'coupons:read',
    description: 'مشاهده کوپن‌ها',
  },
  {
    name: 'coupons:manage',
    description: 'مدیریت کوپن‌ها',
  },
  {
    name: 'coupons:create',
    description: 'ایجاد کوپن',
  },
  {
    name: 'coupons:update',
    description: 'به‌روزرسانی کوپن',
  },
  {
    name: 'coupons:delete',
    description: 'حذف کوپن',
  },
  {
    name: 'promotions:*',
    description: 'دسترسی کامل به تخفیف‌ها و پروموشن‌ها',
  },
  {
    name: 'promotions:read',
    description: 'مشاهده تخفیف‌ها و پروموشن‌ها',
  },
  {
    name: 'promotions:manage',
    description: 'مدیریت تخفیف‌ها و پروموشن‌ها',
  },

  {
    name: 'reviews:*',
    description: 'دسترسی کامل به دیدگاه‌ها',
  },
  {
    name: 'reviews:read',
    description: 'مشاهده دیدگاه‌ها',
  },
  {
    name: 'reviews:manage',
    description: 'مدیریت دیدگاه‌ها',
  },

  {
    name: 'notifications:*',
    description: 'مدیریت کامل اعلان‌ها',
  },
  {
    name: 'notifications:read',
    description: 'مشاهده اعلان‌ها',
  },
  {
    name: 'notifications:manage',
    description: 'مدیریت اعلان‌ها',
  },

  {
    name: 'content:*',
    description: 'دسترسی کامل به محتوای سایت',
  },
  {
    name: 'content:read',
    description: 'مشاهده محتوای سایت',
  },
  {
    name: 'content:manage',
    description: 'مدیریت محتوای سایت',
  },
  {
    name: 'content:create',
    description: 'ایجاد محتوای سایت',
  },
  {
    name: 'content:update',
    description: 'به‌روزرسانی محتوای سایت',
  },
  {
    name: 'content:delete',
    description: 'حذف محتوای سایت',
  },
  {
    name: 'cms:*',
    description: 'دسترسی کامل به سیستم مدیریت محتوا',
  },
  {
    name: 'cms:read',
    description: 'مشاهده سیستم مدیریت محتوا',
  },
  {
    name: 'cms:manage',
    description: 'مدیریت سیستم مدیریت محتوا',
  },

  {
    name: 'settings:*',
    description: 'دسترسی کامل به تنظیمات',
  },
  {
    name: 'settings:read',
    description: 'مشاهده تنظیمات',
  },
  {
    name: 'settings:manage',
    description: 'مدیریت تنظیمات',
  },
  {
    name: 'settings:update',
    description: 'به‌روزرسانی تنظیمات',
  },
  {
    name: 'store-settings:*',
    description: 'دسترسی کامل به تنظیمات فروشگاه',
  },
  {
    name: 'store-settings:read',
    description: 'مشاهده تنظیمات فروشگاه',
  },
  {
    name: 'store-settings:manage',
    description: 'مدیریت تنظیمات فروشگاه',
  },
  {
    name: 'store-settings:update',
    description: 'به‌روزرسانی تنظیمات فروشگاه',
  },

  {
    name: 'support:*',
    description: 'دسترسی کامل به پشتیبانی',
  },
  {
    name: 'support:read',
    description: 'مشاهده پشتیبانی',
  },
  {
    name: 'support:manage',
    description: 'مدیریت پشتیبانی',
  },
  {
    name: 'support:update',
    description: 'به‌روزرسانی پشتیبانی',
  },
  {
    name: 'tickets:*',
    description: 'دسترسی کامل به تیکت‌ها',
  },
  {
    name: 'tickets:read',
    description: 'مشاهده تیکت‌ها',
  },
  {
    name: 'tickets:manage',
    description: 'مدیریت تیکت‌ها',
  },
  {
    name: 'chat:*',
    description: 'دسترسی کامل به گفت‌وگوها',
  },
  {
    name: 'chat:read',
    description: 'مشاهده گفت‌وگوها',
  },
  {
    name: 'chat:manage',
    description: 'مدیریت گفت‌وگوها',
  },

  {
    name: 'analytics:*',
    description: 'دسترسی کامل به تحلیل‌ها',
  },
  {
    name: 'analytics:read',
    description: 'مشاهده تحلیل‌ها',
  },
  {
    name: 'analytics:manage',
    description: 'مدیریت تحلیل‌ها',
  },

  {
    name: 'reports:*',
    description: 'دسترسی کامل به گزارش‌ها',
  },
  {
    name: 'reports:read',
    description: 'مشاهده گزارش‌ها',
  },
  {
    name: 'reports:manage',
    description: 'مدیریت گزارش‌ها',
  },
  {
    name: 'reports:create',
    description: 'ایجاد گزارش',
  },
  {
    name: 'reports:update',
    description: 'به‌روزرسانی گزارش',
  },
  {
    name: 'reports:delete',
    description: 'حذف گزارش',
  },
  {
    name: 'report:*',
    description: 'دسترسی کامل به گزارش مدیریتی',
  },
  {
    name: 'report:read',
    description: 'مشاهده گزارش مدیریتی',
  },
  {
    name: 'report:manage',
    description: 'مدیریت گزارش مدیریتی',
  },

  {
    name: 'search:*',
    description: 'دسترسی کامل به جستجو',
  },
  {
    name: 'search:read',
    description: 'استفاده و مشاهده جستجو',
  },
  {
    name: 'search:manage',
    description: 'مدیریت جستجو',
  },
  {
    name: 'search:update',
    description: 'به‌روزرسانی تنظیمات جستجو',
  },
  {
    name: 'search:index',
    description: 'اجرای ایندکس جستجو',
  },

  {
    name: 'ai:*',
    description: 'دسترسی کامل به هوشمندی سیستم',
  },
  {
    name: 'ai:read',
    description: 'مشاهده مدیریت هوشمندی',
  },
  {
    name: 'ai:manage',
    description: 'مدیریت هوشمندی سیستم',
  },
  {
    name: 'ai:run',
    description: 'اجرای وظایف هوشمند',
  },
  {
    name: 'ai:update',
    description: 'به‌روزرسانی تنظیمات هوشمندی',
  },
  {
    name: 'ai:delete',
    description: 'حذف تنظیمات هوشمندی',
  },

  {
    name: 'security:*',
    description: 'دسترسی کامل به امنیت سیستم',
  },
  {
    name: 'security:read',
    description: 'مشاهده مرکز امنیت',
  },
  {
    name: 'security:manage',
    description: 'مدیریت مرکز امنیت',
  },
  {
    name: 'security:update',
    description: 'به‌روزرسانی تنظیمات امنیت',
  },
  {
    name: 'security:incident',
    description: 'مدیریت رخدادهای امنیتی',
  },
  {
    name: 'admin-security:*',
    description: 'دسترسی کامل به امنیت مدیریت',
  },
  {
    name: 'admin-security:read',
    description: 'مشاهده امنیت مدیریت',
  },
  {
    name: 'admin-security:manage',
    description: 'مدیریت امنیت مدیریت',
  },
  {
    name: 'admin-security:update',
    description: 'به‌روزرسانی امنیت مدیریت',
  },

  {
    name: 'import-export:*',
    description: 'دسترسی کامل به مرکز ورود و خروج داده',
  },
  {
    name: 'import-export:read',
    description: 'مشاهده مرکز ورود و خروج داده',
  },
  {
    name: 'import-export:manage',
    description: 'مدیریت مرکز ورود و خروج داده',
  },
  {
    name: 'import-export:run',
    description: 'اجرای عملیات ورود و خروج داده',
  },
  {
    name: 'import:*',
    description: 'دسترسی کامل به واردسازی داده',
  },
  {
    name: 'import:read',
    description: 'مشاهده Jobهای واردسازی داده',
  },
  {
    name: 'import:manage',
    description: 'مدیریت واردسازی داده',
  },
  {
    name: 'import:run',
    description: 'اجرای واردسازی داده',
  },
  {
    name: 'export:*',
    description: 'دسترسی کامل به خروجی داده',
  },
  {
    name: 'export:read',
    description: 'مشاهده Jobهای خروجی داده',
  },
  {
    name: 'export:manage',
    description: 'مدیریت خروجی داده',
  },
  {
    name: 'export:run',
    description: 'اجرای خروجی داده',
  },

  {
    name: 'queue:*',
    description: 'دسترسی کامل به صف‌ها',
  },
  {
    name: 'queue:read',
    description: 'مشاهده وضعیت صف‌ها',
  },
  {
    name: 'queue:manage',
    description: 'مدیریت صف‌ها',
  },

  {
    name: 'scheduler:*',
    description: 'دسترسی کامل به زمان‌بندی‌ها',
  },
  {
    name: 'scheduler:read',
    description: 'مشاهده زمان‌بندی‌ها',
  },
  {
    name: 'scheduler:manage',
    description: 'مدیریت زمان‌بندی‌ها',
  },
  {
    name: 'scheduler:run',
    description: 'اجرای دستی وظایف زمان‌بندی‌شده',
  },

  {
    name: 'rbac:*',
    description: 'دسترسی کامل به مدیریت نقش‌ها و مجوزها',
  },
  {
    name: 'rbac:read',
    description: 'مشاهده نقش‌ها و مجوزها',
  },
  {
    name: 'rbac:manage',
    description: 'مدیریت نقش‌ها و مجوزها',
  },

  {
    name: 'audit:*',
    description: 'دسترسی کامل به گزارش فعالیت‌ها',
  },
  {
    name: 'audit:read',
    description: 'مشاهده گزارش فعالیت‌ها',
  },
  {
    name: 'audit:manage',
    description: 'مدیریت گزارش فعالیت‌ها',
  },
  {
    name: 'audit:create',
    description: 'ایجاد گزارش فعالیت',
  },
  {
    name: 'audit:delete',
    description: 'حذف گزارش فعالیت',
  },
  {
    name: 'audit:export',
    description: 'خروجی گرفتن از گزارش فعالیت‌ها',
  },

  {
    name: 'audits:*',
    description: 'دسترسی کامل به گزارش‌های فعالیت',
  },
  {
    name: 'audits:read',
    description: 'مشاهده گزارش‌های فعالیت',
  },
  {
    name: 'audits:manage',
    description: 'مدیریت گزارش‌های فعالیت',
  },
  {
    name: 'audits:export',
    description: 'خروجی گرفتن از گزارش‌های فعالیت',
  },

  {
    name: 'activity:*',
    description: 'دسترسی کامل به فعالیت‌ها',
  },
  {
    name: 'activity:read',
    description: 'مشاهده فعالیت‌ها',
  },
  {
    name: 'activity:manage',
    description: 'مدیریت فعالیت‌ها',
  },
] satisfies readonly DefaultPermissionDefinition[];

export const ProtectedSystemRoles = [
  SystemRoles.SUPER_ADMIN,
  SystemRoles.ADMIN,
  SystemRoles.CUSTOMER,
] as const;

export type ProtectedSystemRole = (typeof ProtectedSystemRoles)[number];
