import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="glass-panel w-full max-w-md rounded-[2rem] p-6 md:p-8">
        <Link
          href="/"
          className="text-xs font-bold text-[#a25a73]"
        >
          بازگشت به صفحه اصلی
        </Link>

        <h1 className="mt-6 text-3xl font-black tracking-[-0.05em]">
          ورود به وکسو
        </h1>

        <p className="mt-3 text-sm leading-7 text-[#786974]">
          ورود مشتریان با شماره موبایل و رمز یک‌بارمصرف در مرحله اتصال API فعال
          می‌شود.
        </p>

        <label className="mt-7 block">
          <span className="mb-2 block text-xs font-bold text-[#5a4653]">
            شماره موبایل
          </span>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="09xxxxxxxxx"
            className="h-14 w-full rounded-2xl border border-[#664258]/10 bg-white/70 px-4 text-left outline-none transition focus:border-[#c95c7c]/50"
            dir="ltr"
          />
        </label>

        <button
          type="button"
          className="mt-4 h-14 w-full rounded-2xl bg-[#281923] text-sm font-black text-white"
        >
          دریافت کد ورود
        </button>
      </section>
    </main>
  );
}
