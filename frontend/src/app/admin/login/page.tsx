'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useState } from 'react';

import { BrandMark } from '@/components/ui/brand-mark';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T | null;
};

type AdminLoginData = {
  user?: {
    id?: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  roleName?: string | null;
  sessionId?: string | null;
};

function safeAdminPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/admin') ||
    value.startsWith('//') ||
    value.startsWith('/admin/login')
  ) {
    return '/admin';
  }

  return value;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] =
    useState('');
  const [showPassword, setShowPassword] =
    useState(false);
  const [pending, setPending] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (
      !normalizedEmail ||
      !normalizedEmail.includes('@')
    ) {
      setError('ایمیل مدیریتی معتبر وارد کنید.');
      return;
    }

    if (!password) {
      setError('رمز عبور را وارد کنید.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        '/api/admin/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<AdminLoginData>;

      if (
        !response.ok ||
        payload.success !== true
      ) {
        throw new Error(
          payload.message ||
            'ورود مدیریتی انجام نشد.',
        );
      }

      const requestedPath =
        new URLSearchParams(
          window.location.search,
        ).get('next');

      router.replace(
        safeAdminPath(requestedPath),
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'ورود مدیریتی انجام نشد.',
      );

      setPending(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-visual">
        <Link
          href="/"
          className="admin-login-visual__brand"
        >
          <BrandMark />
          <span>
            <strong>VEXO</strong>
            <small>BEAUTY MANAGEMENT</small>
          </span>
        </Link>

        <div className="admin-login-visual__content">
          <span className="panel-label">
            PRIVATE MANAGEMENT WORKSPACE
          </span>

          <h1>
            کنترل دقیق عملیات،
            <br />
            فروش و تجربه مشتری
          </h1>

          <p>
            این بخش فقط برای مدیران مجاز وکسو بیوتی
            در دسترس است. همهٔ عملیات مدیریتی توسط
            Backend ثبت و کنترل می‌شوند.
          </p>

          <div className="admin-login-features">
            <span>
              <ShieldCheck aria-hidden="true" />
              دسترسی مبتنی بر نقش و مجوز
            </span>

            <span>
              <LockKeyhole aria-hidden="true" />
              نشست مستقل و امن مدیریت
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="admin-login-visual__store"
        >
          <Store aria-hidden="true" />
          بازگشت به فروشگاه
        </Link>
      </section>

      <section className="admin-login-form-panel">
        <form
          className="admin-login-form"
          onSubmit={submit}
        >
          <div className="admin-login-form__icon">
            <LockKeyhole aria-hidden="true" />
          </div>

          <span className="panel-label">
            ADMIN ACCESS
          </span>

          <h2>ورود به پنل مدیریت</h2>

          <p>
            ایمیل و رمز عبور حساب دارای نقش مدیریت را
            وارد کنید.
          </p>

          <label>
            <span>ایمیل مدیریتی</span>

            <div className="admin-login-input">
              <Mail aria-hidden="true" />

              <input
                type="email"
                dir="ltr"
                autoComplete="username"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="admin@example.com"
                disabled={pending}
                required
              />
            </div>
          </label>

          <label>
            <span>رمز عبور</span>

            <div className="admin-login-input">
              <LockKeyhole aria-hidden="true" />

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                disabled={pending}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                aria-label={
                  showPassword
                    ? 'مخفی‌کردن رمز عبور'
                    : 'نمایش رمز عبور'
                }
                disabled={pending}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          {error ? (
            <p
              className="admin-login-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="button button--primary"
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle
                className="is-spinning"
                aria-hidden="true"
              />
            ) : (
              <ArrowLeft aria-hidden="true" />
            )}

            {pending
              ? 'در حال بررسی دسترسی...'
              : 'ورود امن به مدیریت'}
          </button>

          <small>
            اطلاعات ورود در مرورگر یا Frontend ذخیره
            نمی‌شوند.
          </small>
        </form>
      </section>
    </main>
  );
}
