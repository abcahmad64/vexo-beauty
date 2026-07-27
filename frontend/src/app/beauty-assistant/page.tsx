import Link from 'next/link';

export default function BeautyAssistantPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#181117] p-5 text-white">
      <section className="w-full max-w-2xl rounded-[2.2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl">
        <Link href="/" className="text-sm font-bold text-[#ed9ab4]">
          بازگشت
        </Link>
        <h1 className="mt-7 text-4xl font-black tracking-[-0.06em]">
          مشاور هوشمند زیبایی
        </h1>
        <p className="mt-4 leading-8 text-white/55">
          رابط کامل گفتگو پس از اتصال Endpoint عمومی AI، مدیریت Session و
          نمایش پیشنهاد محصولات فعال می‌شود.
        </p>
      </section>
    </main>
  );
}
