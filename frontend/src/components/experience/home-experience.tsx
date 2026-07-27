'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpLeft,
  Bot,
  ChevronLeft,
  CircleUserRound,
  Heart,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

const categories = [
  {
    id: 'skin',
    eyebrow: 'SKIN',
    title: 'مراقبت پوست',
    description: 'روتین‌های هوشمند بر اساس نیاز واقعی پوست',
    tone: 'from-[#f5d9df] via-[#f7eceb] to-[#cfa6ae]',
    symbol: '01',
  },
  {
    id: 'makeup',
    eyebrow: 'MAKEUP',
    title: 'آرایش',
    description: 'رنگ، بافت و جلوه‌ای هماهنگ با هویت تو',
    tone: 'from-[#ebc0cb] via-[#d7889e] to-[#704055]',
    symbol: '02',
  },
  {
    id: 'perfume',
    eyebrow: 'SCENT',
    title: 'عطر و رایحه',
    description: 'کشف رایحه بر اساس شخصیت و حس لحظه',
    tone: 'from-[#efe5d5] via-[#d8b994] to-[#6e5146]',
    symbol: '03',
  },
  {
    id: 'hair',
    eyebrow: 'HAIR',
    title: 'مراقبت مو',
    description: 'راهکار تخصصی برای جنس و وضعیت موی تو',
    tone: 'from-[#e5d9d4] via-[#a98578] to-[#402c32]',
    symbol: '04',
  },
];

const signals = [
  'اصالت تضمین‌شده',
  'مشاوره هوشمند',
  'انتخاب شخصی‌سازی‌شده',
  'ارسال سریع',
  'تحلیل تخصصی محصول',
  'تجربه خرید متفاوت',
];

const products = [
  {
    title: 'سرم بازسازی شب',
    subtitle: 'Night Reset Serum',
    price: '۲٬۸۹۰٬۰۰۰',
    badge: 'انتخاب هوشمند',
    score: '۹۶٪ تطابق',
    tone: 'from-[#f0d8dc] to-[#9b6275]',
  },
  {
    title: 'کرم ابریشمی روز',
    subtitle: 'Silk Barrier Cream',
    price: '۲٬۳۵۰٬۰۰۰',
    badge: 'پرفروش',
    score: '۴.۹ امتیاز',
    tone: 'from-[#eee6dd] to-[#b99572]',
  },
  {
    title: 'اسنس درخشان‌کننده',
    subtitle: 'Luminous Essence',
    price: '۱٬۹۸۰٬۰۰۰',
    badge: 'جدید',
    score: '۹۲٪ رضایت',
    tone: 'from-[#f6d2dd] to-[#c26685]',
  },
];

function Logo() {
  return (
    <Link
      href="/"
      aria-label="صفحه اصلی وکسو بیوتی"
      className="group inline-flex items-center gap-3"
    >
      <span className="relative grid size-11 place-items-center overflow-hidden rounded-[1.15rem] bg-[#281923] text-white shadow-[0_14px_32px_rgba(52,28,45,.18)]">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,.3),transparent_32%)]" />
        <Sparkles className="relative size-5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
      </span>

      <span className="leading-none">
        <span className="block text-[1.16rem] font-black tracking-[-0.05em] text-[#281923]">
          وکسو بیوتی
        </span>
        <span className="mt-1 block text-[0.62rem] font-medium tracking-[0.28em] text-[#9d7a8b]">
          VEXO BEAUTY
        </span>
      </span>
    </Link>
  );
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    ['فروشگاه', '#discover'],
    ['مراقبت پوست', '#categories'],
    ['آرایش', '#categories'],
    ['عطر', '#categories'],
    ['مشاور هوشمند', '#ai-consultant'],
  ];

  return (
    <header className="sticky top-0 z-50 py-3">
      <div className="container-vexo">
        <div className="glass-panel flex min-h-16 items-center justify-between rounded-[1.45rem] px-3.5 md:px-5">
          <Logo />

          <nav
            aria-label="ناوبری اصلی"
            className="hidden items-center gap-1 lg:flex"
          >
            {navigation.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#625360] transition hover:bg-white/70 hover:text-[#281923]"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="جستجو"
              className="grid size-10 place-items-center rounded-full text-[#4d3d49] transition hover:bg-white hover:shadow-sm"
            >
              <Search className="size-[1.15rem]" />
            </button>

            <button
              type="button"
              aria-label="علاقه‌مندی‌ها"
              className="hidden size-10 place-items-center rounded-full text-[#4d3d49] transition hover:bg-white hover:shadow-sm sm:grid"
            >
              <Heart className="size-[1.15rem]" />
            </button>

            <button
              type="button"
              aria-label="سبد خرید"
              className="relative grid size-10 place-items-center rounded-full text-[#4d3d49] transition hover:bg-white hover:shadow-sm"
            >
              <ShoppingBag className="size-[1.15rem]" />
              <span className="absolute end-0 top-0 grid size-4 place-items-center rounded-full bg-[#c95c7c] text-[0.58rem] font-bold text-white">
                ۰
              </span>
            </button>

            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-full bg-[#281923] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(47,25,40,.18)] transition hover:-translate-y-0.5 hover:bg-[#3a2534] md:flex"
            >
              <CircleUserRound className="size-4" />
              ورود
            </Link>

            <button
              type="button"
              aria-label={mobileOpen ? 'بستن منو' : 'باز کردن منو'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((current) => !current)}
              className="grid size-10 place-items-center rounded-full text-[#4d3d49] lg:hidden"
            >
              {mobileOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.nav
              aria-label="منوی موبایل"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="glass-panel mt-2 grid rounded-[1.5rem] p-3 lg:hidden"
            >
              {navigation.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-bold text-[#473843] hover:bg-white/70"
                >
                  {label}
                </Link>
              ))}

              <Link
                href="/login"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#281923] px-4 py-3 text-sm font-bold text-white"
              >
                <CircleUserRound className="size-4" />
                ورود به حساب
              </Link>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

function FloatingBadge({
  className,
  icon,
  title,
  subtitle,
}: {
  className: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 4.8,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
      }}
      className={`glass-panel absolute z-10 flex items-center gap-3 rounded-2xl p-3 ${className}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-[#2e1e2a] text-white">
        {icon}
      </span>
      <span>
        <strong className="block text-xs font-black text-[#33252f]">
          {title}
        </strong>
        <span className="mt-1 block text-[0.67rem] text-[#877481]">
          {subtitle}
        </span>
      </span>
    </motion.div>
  );
}

function ProductSculpture() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-label="تصویر مفهومی محصول زیبایی وکسو"
      role="img"
      className="product-stage relative grid min-h-[27rem] place-items-center md:min-h-[34rem] lg:min-h-[39rem]"
    >
      <div className="aurora end-[7%] top-[8%] size-52 bg-[#e7a8ba]/40" />
      <div className="aurora bottom-[5%] start-[4%] size-60 bg-[#b99a77]/25" />

      <motion.div
        initial={false}
        animate={{
          opacity: 1,
          rotateY: reduceMotion ? 0 : [0, 5, 0, -4, 0],
          rotateX: reduceMotion ? 0 : [0, -2, 1, 0],
          y: reduceMotion ? 0 : [0, -10, 0],
        }}
        transition={{
          opacity: { duration: 0.8 },
          rotateY: {
            duration: 10,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          },
          rotateX: {
            duration: 9,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          },
          y: {
            duration: 5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          },
        }}
        className="product-bottle"
      >
        <div className="product-bottle__cap" />

        <div className="product-bottle__body">
          <div className="product-bottle__liquid" />
        </div>

        <div className="product-bottle__label">
          <span className="block text-[0.58rem] font-semibold tracking-[0.36em] text-[#9d7689]">
            VEXO LAB
          </span>
          <strong className="mt-2 block text-xl font-black tracking-[-0.05em] text-[#35242f]">
            LUMINA
          </strong>
          <span className="mt-1 block text-[0.62rem] text-[#8a7581]">
            INTELLIGENT BEAUTY ESSENCE
          </span>
        </div>
      </motion.div>

      <FloatingBadge
        className="start-0 top-[14%] md:start-[3%]"
        icon={<Sparkles className="size-4" />}
        title="انتخاب شخصی‌سازی‌شده"
        subtitle="براساس نیاز و ترجیح تو"
      />

      <FloatingBadge
        className="bottom-[11%] end-0 md:end-[1%]"
        icon={<ShieldCheck className="size-4" />}
        title="اصالت و کیفیت"
        subtitle="بررسی‌شده توسط وکسو"
      />

      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 18,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
        className="absolute end-[5%] top-[12%] grid size-20 place-items-center rounded-full border border-[#7c5069]/15 text-center text-[0.54rem] font-bold tracking-[0.15em] text-[#76576a]"
      >
        BEAUTY
        <br />
        INTELLIGENCE
      </motion.div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-14">
      <div className="container-vexo grid items-center gap-8 md:grid-cols-[1.03fr_.97fr] lg:gap-12">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="hero-content relative z-10"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6d455d]/10 bg-white/55 px-3.5 py-2 text-xs font-bold text-[#795d6e] shadow-sm backdrop-blur-xl">
            <WandSparkles className="size-4 text-[#c95c7c]" />
            تجربه تازه‌ای از زیبایی هوشمند
          </div>

          <h1 className="text-balance max-w-3xl text-[clamp(3.15rem,7.4vw,7.35rem)] font-black leading-[0.93] tracking-[-0.085em] text-[#281b24]">
            زیبایی،
            <br />
            این‌بار
            <span className="text-gradient"> برای تو.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base font-medium leading-8 text-[#71626d] md:text-lg md:leading-9">
            وکسو فقط یک فروشگاه نیست؛ یک تجربه شخصی‌سازی‌شده برای کشف
            محصولاتی است که واقعاً با پوست، مو، سلیقه و سبک زندگی تو هماهنگ‌اند.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="#discover"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#281923] px-7 text-sm font-black text-white shadow-[0_20px_50px_rgba(53,29,46,.22)] transition duration-300 hover:-translate-y-1 hover:bg-[#3a2434]"
            >
              شروع کشف زیبایی
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </Link>

            <Link
              href="#ai-consultant"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[#6d455d]/12 bg-white/60 px-7 text-sm font-black text-[#432f3e] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white"
            >
              <Bot className="size-[1.1rem] text-[#c95c7c]" />
              مشاوره هوشمند
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4 text-xs font-bold text-[#75646f]">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#a16a80]" />
              تضمین اصالت
            </span>
            <span className="flex items-center gap-2">
              <Zap className="size-4 text-[#b68b5f]" />
              ارسال سریع
            </span>
            <span className="flex items-center gap-2">
              <Star className="size-4 fill-[#c95c7c] text-[#c95c7c]" />
              تجربه شخصی
            </span>
          </div>
        </motion.div>

        <ProductSculpture />
      </div>
    </section>
  );
}

function SignalMarquee() {
  const repeated = [...signals, ...signals];

  return (
    <div className="overflow-hidden border-y border-[#57394e]/8 bg-white/38 py-4 backdrop-blur-lg">
      <div className="marquee-track">
        {repeated.map((signal, index) => (
          <div
            key={`${signal}-${index}`}
            className="flex items-center gap-5 px-6 text-xs font-black text-[#66525f] md:text-sm"
          >
            <Sparkles className="size-3.5 text-[#c95c7c]" />
            {signal}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="text-xs font-black tracking-[0.22em] text-[#b25f7a]">
        {eyebrow}
      </span>

      <h2 className="mt-4 text-balance text-3xl font-black tracking-[-0.055em] text-[#2d2029] md:text-5xl md:leading-[1.15]">
        {title}
      </h2>

      <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-[#786974] md:text-base md:leading-8">
        {description}
      </p>
    </div>
  );
}

function Categories() {
  return (
    <section id="categories" className="py-20 md:py-28">
      <div className="container-vexo">
        <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="DISCOVER YOUR WORLD"
            title="هر نیاز، یک جهان متفاوت."
            description="به‌جای فهرست‌های شلوغ، مسیرهای دقیق و الهام‌بخش برای کشف چیزی که واقعاً لازم داری."
          />

          <Link
            href="/shop"
            className="group inline-flex w-fit items-center gap-2 text-sm font-black text-[#4c3545]"
          >
            مشاهده همه دسته‌ها
            <ArrowLeft className="size-4 transition group-hover:-translate-x-1" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {categories.map((category, index) => (
            <motion.article
              key={category.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: index * 0.06, duration: 0.55 }}
              whileHover={{ y: -8 }}
              className={`group relative min-h-[24rem] overflow-hidden rounded-[2.2rem] bg-gradient-to-br ${category.tone} p-6 shadow-[0_30px_70px_rgba(57,35,49,.12)]`}
            >
              <div className="absolute -end-20 -top-20 size-56 rounded-full border border-white/30" />
              <div className="absolute -end-4 top-16 size-32 rounded-full bg-white/16 blur-xl" />

              <span className="relative text-[0.65rem] font-black tracking-[0.3em] text-white/70">
                {category.eyebrow}
              </span>

              <div className="absolute inset-x-6 bottom-6">
                <span className="mb-12 block text-[5.5rem] font-black leading-none tracking-[-0.1em] text-white/13">
                  {category.symbol}
                </span>

                <h3 className="text-2xl font-black tracking-[-0.04em] text-white">
                  {category.title}
                </h3>

                <p className="mt-3 max-w-[15rem] text-sm font-medium leading-7 text-white/76">
                  {category.description}
                </p>

                <Link
                  href={`/shop?category=${category.id}`}
                  aria-label={`مشاهده ${category.title}`}
                  className="mt-5 grid size-11 place-items-center rounded-full bg-white text-[#442e3d] shadow-lg transition duration-300 group-hover:-translate-x-1"
                >
                  <ArrowUpLeft className="size-4" />
                </Link>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiConsultant() {
  const options = ['پوست خشک', 'پوست حساس', 'جوش و لک', 'درخشندگی'];

  return (
    <section id="ai-consultant" className="py-10 md:py-20">
      <div className="container-vexo">
        <div className="relative overflow-hidden rounded-[2.7rem] bg-[#1d141c] px-5 py-10 text-white shadow-[0_50px_120px_rgba(34,19,30,.25)] md:px-12 md:py-14 lg:px-16">
          <div className="absolute -end-32 -top-32 size-[28rem] rounded-full bg-[#bd5d7d]/20 blur-3xl" />
          <div className="absolute -bottom-40 start-[-7rem] size-[30rem] rounded-full bg-[#b9986f]/14 blur-3xl" />

          <div className="relative grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-xs font-bold text-white/70">
                <Bot className="size-4 text-[#f0a2ba]" />
                VEXO BEAUTY INTELLIGENCE
              </div>

              <h2 className="mt-6 text-balance text-4xl font-black leading-[1.17] tracking-[-0.065em] md:text-6xl">
                یک مشاور که
                <br />
                واقعاً تو را می‌شناسد.
              </h2>

              <p className="mt-5 max-w-xl text-sm font-medium leading-8 text-white/58 md:text-base">
                هدف، پیشنهاد تصادفی محصول نیست. اطلاعات، نیازها و ترجیحات تو
                تحلیل می‌شوند تا مسیر انتخاب کوتاه‌تر، شفاف‌تر و مطمئن‌تر شود.
              </p>

              <Link
                href="/beauty-assistant"
                className="mt-7 inline-flex min-h-13 items-center gap-3 rounded-full bg-white px-6 text-sm font-black text-[#261823] transition hover:-translate-y-1"
              >
                شروع گفت‌وگو
                <ArrowLeft className="size-4" />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 backdrop-blur-2xl md:p-6">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-3">
                  <span className="relative grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#d66f90] to-[#75435d]">
                    <Bot className="size-5" />
                    <span className="absolute -bottom-1 -end-1 size-3 rounded-full border-2 border-[#21161f] bg-emerald-400" />
                  </span>

                  <span>
                    <strong className="block text-sm">مشاور وکسو</strong>
                    <span className="mt-1 block text-[0.66rem] text-white/43">
                      آماده تحلیل نیاز تو
                    </span>
                  </span>
                </div>

                <Sparkles className="size-5 text-[#e38ba6]" />
              </div>

              <div className="mt-6 space-y-4">
                <div className="max-w-[88%] rounded-[1.4rem_1.4rem_.4rem_1.4rem] bg-white/8 p-4 text-sm leading-7 text-white/78">
                  برای شروع، مهم‌ترین دغدغه پوستت در حال حاضر چیست؟
                </div>

                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-white/68 transition hover:border-[#d87896]/50 hover:bg-[#d87896]/15 hover:text-white"
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/12 p-3">
                  <span className="flex-1 text-xs text-white/35">
                    پاسخ خود را بنویس...
                  </span>
                  <button
                    type="button"
                    aria-label="ارسال پاسخ"
                    className="grid size-10 place-items-center rounded-xl bg-[#d16a8a] text-white"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-[0.62rem] text-white/32">
                <ShieldCheck className="size-3.5" />
                پاسخ‌ها برای شخصی‌سازی تجربه استفاده می‌شوند.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  index,
}: {
  product: (typeof products)[number];
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="group"
    >
      <div
        className={`relative aspect-[.82] overflow-hidden rounded-[2rem] bg-gradient-to-br ${product.tone} p-5 shadow-[0_26px_65px_rgba(56,34,48,.12)]`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_12%,rgba(255,255,255,.65),transparent_30%)]" />

        <span className="relative inline-flex rounded-full border border-white/30 bg-white/45 px-3 py-1.5 text-[0.65rem] font-black text-[#553847] backdrop-blur-lg">
          {product.badge}
        </span>

        <button
          type="button"
          aria-label={`افزودن ${product.title} به علاقه‌مندی‌ها`}
          className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-white/50 text-[#4d3442] backdrop-blur-lg transition hover:bg-white"
        >
          <Heart className="size-4" />
        </button>

        <div className="absolute inset-x-[23%] bottom-[13%] top-[21%] rounded-[46%_46%_28%_28%/25%_25%_17%_17%] border border-white/50 bg-gradient-to-br from-white/70 via-white/20 to-[#4f293e]/40 shadow-[inset_12px_6px_25px_rgba(255,255,255,.45),0_30px_50px_rgba(62,34,50,.2)] transition duration-500 group-hover:-translate-y-2 group-hover:rotate-2">
          <div className="absolute inset-x-[14%] top-[43%] rounded-lg bg-white/65 px-2 py-3 text-center backdrop-blur-md">
            <span className="block text-[0.48rem] font-bold tracking-[0.28em] text-[#765767]">
              VEXO EDIT
            </span>
            <span className="mt-1 block text-xs font-black text-[#3e2b36]">
              BEAUTY LAB
            </span>
          </div>
        </div>

        <div className="absolute bottom-4 start-4 rounded-full bg-[#281923]/80 px-3 py-1.5 text-[0.62rem] font-bold text-white backdrop-blur-lg">
          {product.score}
        </div>
      </div>

      <div className="px-1 pt-5">
        <span className="text-[0.65rem] font-semibold tracking-[0.12em] text-[#a48898]">
          {product.subtitle}
        </span>

        <div className="mt-1.5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-black tracking-[-0.03em] text-[#32242d]">
              {product.title}
            </h3>
            <p className="mt-2 text-sm font-black text-[#6d4b5d]">
              {product.price}
              <span className="me-1 text-[0.65rem] font-semibold text-[#9b8793]">
                تومان
              </span>
            </p>
          </div>

          <button
            type="button"
            aria-label={`افزودن ${product.title} به سبد خرید`}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#2b1c27] text-white transition duration-300 hover:-translate-y-1 hover:bg-[#c45f7d]"
          >
            <ShoppingBag className="size-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function DiscoverProducts() {
  return (
    <section id="discover" className="py-20 md:py-28">
      <div className="container-vexo">
        <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="CURATED FOR YOU"
            title="محصولات انتخاب‌شده، نه فهرست بی‌پایان."
            description="نمونه‌ای از تجربه‌ای که در آن محصول، دلیل انتخاب و میزان تناسب آن با نیاز کاربر کنار هم نمایش داده می‌شوند."
          />

          <div className="flex gap-2">
            <button
              type="button"
              aria-label="محصول قبلی"
              className="grid size-11 place-items-center rounded-full border border-[#67455a]/10 bg-white/60 text-[#513849] transition hover:bg-white"
            >
              <ChevronLeft className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="محصول بعدی"
              className="grid size-11 place-items-center rounded-full bg-[#2c1e28] text-white transition hover:-translate-y-0.5"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <ProductCard
              key={product.title}
              product={product}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="pb-20 pt-5 md:pb-28">
      <div className="container-vexo">
        <div className="grid overflow-hidden rounded-[2.6rem] border border-[#664258]/8 bg-[#f1e6e5] lg:grid-cols-2">
          <div className="relative min-h-[24rem] overflow-hidden bg-gradient-to-br from-[#dca4b4] via-[#8d586f] to-[#34222e]">
            <div className="absolute -start-16 top-14 size-60 rounded-full border border-white/15" />
            <div className="absolute end-[-4rem] top-[-3rem] size-72 rounded-full bg-white/13 blur-3xl" />

            <div className="absolute inset-0 grid place-items-center">
              <div className="relative size-56 rounded-full border border-white/25 p-4 md:size-72">
                <div className="grid size-full place-items-center rounded-full border border-white/15 bg-white/8 backdrop-blur-xl">
                  <span className="text-center text-5xl font-black leading-none tracking-[-0.1em] text-white md:text-7xl">
                    V
                    <span className="block text-[0.65rem] tracking-[0.35em] text-white/55">
                      VEXO
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-7 md:p-12 lg:p-16">
            <span className="text-xs font-black tracking-[0.23em] text-[#aa6279]">
              OUR POINT OF VIEW
            </span>

            <h2 className="mt-5 text-balance text-4xl font-black leading-[1.2] tracking-[-0.065em] text-[#30212b] md:text-5xl">
              زیبایی قرار نیست
              <br />
              شبیه همه باشد.
            </h2>

            <p className="mt-6 text-sm font-medium leading-8 text-[#75636e] md:text-base">
              هویت وکسو بر انتخاب آگاهانه، تجربه انسانی و فناوری مسئولانه بنا
              می‌شود. طراحی ما باید زیبا باشد، اما زیبایی آن هرگز نباید سرعت،
              وضوح یا اعتماد کاربر را قربانی کند.
            </p>

            <Link
              href="/about"
              className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-black text-[#503246]"
            >
              داستان وکسو
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#604052]/8 bg-white/35 py-12 backdrop-blur-xl">
      <div className="container-vexo">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_.75fr_.75fr_.75fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm text-sm font-medium leading-7 text-[#7b6974]">
              وکسو بیوتی؛ تجربه‌ای هوشمند، شخصی و الهام‌بخش برای انتخاب محصولات
              زیبایی.
            </p>
          </div>

          {[
            {
              title: 'کشف محصولات',
              links: ['مراقبت پوست', 'آرایش', 'مو', 'عطر'],
            },
            {
              title: 'خدمات وکسو',
              links: ['مشاور هوشمند', 'پیگیری سفارش', 'سؤالات متداول', 'تماس'],
            },
            {
              title: 'درباره ما',
              links: ['داستان وکسو', 'اصالت کالا', 'حریم خصوصی', 'قوانین'],
            },
          ].map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-black text-[#34252e]">
                {group.title}
              </h3>

              <div className="mt-4 grid gap-3">
                {group.links.map((link) => (
                  <Link
                    key={link}
                    href="/"
                    className="w-fit text-xs font-semibold text-[#85737e] transition hover:text-[#b55574]"
                  >
                    {link}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-[#604052]/8 pt-6 text-[0.68rem] font-medium text-[#95838e] sm:flex-row">
          <span>© ۲۰۲۶ وکسو بیوتی؛ تمامی حقوق محفوظ است.</span>
          <span>طراحی‌شده برای یک تجربه متفاوت از زیبایی</span>
        </div>
      </div>
    </footer>
  );
}

export function HomeExperience() {
  return (
    <main className="page-shell">
      <Header />
      <Hero />
      <SignalMarquee />
      <Categories />
      <AiConsultant />
      <DiscoverProducts />
      <Manifesto />
      <Footer />
    </main>
  );
}
