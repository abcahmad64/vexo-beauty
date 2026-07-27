import Link from 'next/link';

export default function ShopPage() {
  return (
    <main className="container-vexo min-h-screen py-16">
      <Link href="/" className="text-sm font-bold text-[#aa5c76]">
        بازگشت
      </Link>
      <h1 className="mt-8 text-5xl font-black tracking-[-0.06em]">
        فروشگاه وکسو
      </h1>
      <p className="mt-5 max-w-xl leading-8 text-[#766570]">
        این صفحه در مرحله اتصال Catalog API به فیلتر، جستجوی فارسی، مرتب‌سازی
        هوشمند و پیشنهادهای شخصی مجهز می‌شود.
      </p>
    </main>
  );
}
