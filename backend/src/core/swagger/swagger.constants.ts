export const SWAGGER_DEFAULT_PATH = 'docs';

export const SWAGGER_DEFAULT_JSON_PATH = 'docs-json';

export const SWAGGER_DEFAULT_YAML_PATH = 'docs-yaml';

export const SWAGGER_AUTH_NAME = 'access-token';

export const SWAGGER_API_TAGS = [
  {
    name: 'Health',
    description: 'بررسی سلامت سرویس‌ها، دیتابیس، Redis، Storage و AI.',
  },
  {
    name: 'App',
    description: 'مسیرهای پایه و عمومی برنامه.',
  },
  {
    name: 'Auth',
    description:
      'احراز هویت، ورود مشتری با موبایل و OTP، تمدید توکن و خروج کاربر.',
  },
  {
    name: 'Rbac',
    description: 'مدیریت نقش‌ها، مجوزها، دسترسی کاربران و کنترل سطح دسترسی.',
  },
  {
    name: 'User',
    description:
      'مدیریت کاربران، پروفایل، وضعیت حساب و عملیات مدیریتی کاربران.',
  },
  {
    name: 'Address',
    description: 'مدیریت آدرس‌های کاربران و آدرس پیش‌فرض ارسال.',
  },
  {
    name: 'Category',
    description: 'مدیریت دسته‌بندی‌های فروشگاه و ساختار درختی دسته‌ها.',
  },
  {
    name: 'Brand',
    description: 'مدیریت برندها، لوگو، وضعیت فعال بودن و اطلاعات برند.',
  },
  {
    name: 'Attribute',
    description:
      'مدیریت ویژگی‌ها، مقادیر ویژگی‌ها و اتصال آن‌ها به محصول و تنوع محصول.',
  },
  {
    name: 'Product',
    description:
      'مدیریت محصولات فروشگاه، قیمت، موجودی، دسته‌بندی، برند و وضعیت انتشار.',
  },
  {
    name: 'Variant',
    description: 'مدیریت تنوع‌های محصول، SKU، قیمت، تصویر و وضعیت فعال بودن.',
  },
  {
    name: 'Media',
    description:
      'مدیریت فایل‌ها، تصاویر محصول، لوگوی برند، تصویر دسته‌بندی و آواتار کاربر.',
  },
  {
    name: 'Inventory',
    description: 'مدیریت انبار، موجودی، رزرو، آزادسازی و ثبت حرکت‌های انبار.',
  },
  {
    name: 'Cart',
    description:
      'مدیریت سبد خرید، افزودن کالا، تغییر تعداد، حذف و ادغام سبد خرید.',
  },
  {
    name: 'Wishlist',
    description: 'مدیریت علاقه‌مندی‌ها و وضعیت علاقه‌مندی محصول برای کاربر.',
  },
  {
    name: 'Coupon',
    description: 'اعتبارسنجی، اعمال و مدیریت کدهای تخفیف فروشگاه.',
  },
  {
    name: 'Order',
    description:
      'ثبت سفارش، مشاهده سفارش‌های کاربر، مدیریت وضعیت سفارش و عملیات مدیریتی.',
  },
  {
    name: 'Payment',
    description: 'ثبت پرداخت، تکمیل، شکست، همگام‌سازی و مدیریت پرداخت‌ها.',
  },
  {
    name: 'Refund',
    description: 'مدیریت بازپرداخت، پردازش، تکمیل یا شکست بازپرداخت.',
  },
  {
    name: 'Invoice',
    description: 'صدور، مشاهده، لغو و مدیریت فاکتورهای سفارش.',
  },
  {
    name: 'Shipment',
    description: 'مدیریت ارسال، رهگیری، تحویل، لغو و وضعیت حمل سفارش.',
  },
  {
    name: 'Review',
    description: 'مدیریت دیدگاه‌ها، امتیازدهی، تأیید و حذف دیدگاه محصول.',
  },
  {
    name: 'Search',
    description: 'جستجوی محصول، دسته‌بندی، برند، پیشنهادها و جستجوی مدیریتی.',
  },
  {
    name: 'Notification',
    description: 'مدیریت اعلان‌ها، وضعیت خوانده‌شدن و اعلان‌های سیستمی.',
  },
  {
    name: 'Analytics',
    description: 'آمار فروشگاه، گزارش‌ها، داشبورد و داده‌های تحلیلی.',
  },
  {
    name: 'Ai',
    description:
      'مشاوره هوشمند، پیشنهاد محصول، تولید محتوا و قابلیت‌های AI فروشگاه.',
  },
  {
    name: 'Recommendation',
    description: 'پیشنهاد محصولات مشابه، پرفروش، ترند، جدید و شخصی‌سازی‌شده.',
  },
  {
    name: 'Admin',
    description:
      'داشبورد مدیریت، نمای کلی، فعالیت‌ها و داده‌های مدیریتی فروشگاه.',
  },
] as const;

export type SwaggerApiTag = (typeof SWAGGER_API_TAGS)[number];
