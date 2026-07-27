import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="container-vexo min-h-screen py-16">
      <Link href="/" className="text-sm font-bold text-[#aa5c76]">
        بازگشت
      </Link>
      <h1 className="mt-8 text-5xl font-black tracking-[-0.06em]">
        داستان وکسو
      </h1>
      <p className="mt-5 max-w-2xl leading-9 text-[#766570]">
        وکسو برای تبدیل انتخاب پیچیده محصولات زیبایی به تجربه‌ای شفاف، شخصی و
        قابل‌اعتماد ساخته می‌شود.
      </p>
    </main>
  );
}
