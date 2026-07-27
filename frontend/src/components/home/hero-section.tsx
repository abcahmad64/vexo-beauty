import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UsersRound,
} from 'lucide-react';

import type { PublicHero } from '@/types/storefront';

type HeroSectionProps = {
  hero: PublicHero | null;
};

export function HeroSection({ hero }: HeroSectionProps) {
  if (!hero) {
    return null;
  }

  return (
    <section className="hero" aria-labelledby="home-hero-title">
      <div className="hero__visual">
        <div
          className="hero-art hero-art--abstract"
          aria-hidden="true"
        >
          <div className="hero-art__halo" />
          <div className="hero-art__halo hero-art__halo--inner" />
          <div className="hero-art__glow" />
          <div className="hero-art__core">
            <Sparkles aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="hero__copy">
        <span className="hero__eyebrow">وکسو بیوتی</span>

        <h1 id="home-hero-title">
          <span>{hero.title}</span>
        </h1>

        {hero.subtitle ? <p>{hero.subtitle}</p> : null}

        <div className="hero__actions">
          {hero.primaryAction ? (
            <Link
              href={hero.primaryAction.path}
              className="button button--primary"
            >
              {hero.primaryAction.label}
              <ArrowLeft aria-hidden="true" />
            </Link>
          ) : null}

          {hero.secondaryAction ? (
            <Link
              href={hero.secondaryAction.path}
              className="button button--secondary"
            >
              {hero.secondaryAction.label}
              <Sparkles aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="trust-strip">
        <div>
          <Truck aria-hidden="true" />
          <span>
            <strong>ارسال مطمئن</strong>
            <small>پیگیری سفارش</small>
          </span>
        </div>

        <div>
          <ShoppingCart aria-hidden="true" />
          <span>
            <strong>خرید آسان</strong>
            <small>فرایند امن خرید</small>
          </span>
        </div>

        <div>
          <UsersRound aria-hidden="true" />
          <span>
            <strong>تجربهٔ مشتری</strong>
            <small>انتخاب آگاهانه‌تر</small>
          </span>
        </div>

        <div>
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>دادهٔ عمومی امن</strong>
            <small>اطلاعات کنترل‌شده</small>
          </span>
        </div>

        <div>
          <BadgeCheck aria-hidden="true" />
          <span>
            <strong>قیمت قابل نمایش</strong>
            <small>بر مبنای Backend</small>
          </span>
        </div>
      </div>
    </section>
  );
}
