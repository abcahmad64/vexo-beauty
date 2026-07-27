'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  LoaderCircle,
  MapPin,
  PackageOpen,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import { CheckoutSubmitButton } from '@/components/checkout/checkout-submit-button';

import type {
  ApiEnvelope,
  CheckoutBootstrap,
  CustomerAddress,
  ProductMoneyValue,
} from '@/types/storefront';

type AddressForm = {
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  street: string;
  apartment: string;
  isDefault: boolean;
};

const initialAddressForm: AddressForm = {
  title: 'خانه',
  firstName: '',
  lastName: '',
  phone: '',
  country: 'ایران',
  state: '',
  city: '',
  postalCode: '',
  street: '',
  apartment: '',
  isDefault: true,
};

function formatMoney(
  value: ProductMoneyValue | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function CheckoutScreen() {
  const [bootstrap, setBootstrap] =
    useState<CheckoutBootstrap | null>(null);

  const [selectedAddressId, setSelectedAddressId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<AddressForm>(initialAddressForm);

  const [showForm, setShowForm] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [savingAddress, setSavingAddress] =
    useState(false);

  const [unauthorized, setUnauthorized] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const loadCheckout = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        '/api/checkout/bootstrap',
        {
          cache: 'no-store',
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<CheckoutBootstrap>;

      if (response.status === 401) {
        setUnauthorized(true);
        setBootstrap(null);
        return;
      }

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'دریافت اطلاعات تسویه‌حساب انجام نشد.',
        );
      }

      setUnauthorized(false);
      setBootstrap(payload.data);

      const addresses =
        payload.data.addresses.data ?? [];

      const defaultAddress =
        addresses.find(
          (address) => address.isDefault,
        ) ?? addresses[0];

      setSelectedAddressId(
        defaultAddress?.id ?? null,
      );

      setShowForm(addresses.length === 0);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت اطلاعات تسویه‌حساب انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCheckout();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadCheckout]);

  async function createAddress(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSavingAddress(true);
    setMessage(null);

    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const payload =
        (await response.json()) as ApiEnvelope<CustomerAddress>;

      if (
        !response.ok ||
        !payload.success ||
        !payload.data
      ) {
        throw new Error(
          payload.message ||
            'ثبت آدرس انجام نشد.',
        );
      }

      await loadCheckout();

      setSelectedAddressId(payload.data.id);
      setShowForm(false);
      setForm(initialAddressForm);
      setMessage('آدرس جدید با موفقیت ثبت شد.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'ثبت آدرس انجام نشد.',
      );
    } finally {
      setSavingAddress(false);
    }
  }

  if (loading) {
    return (
      <main className="checkout-page">
        <div className="checkout-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />
          <p>در حال آماده‌سازی تسویه‌حساب...</p>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="checkout-page">
        <div className="checkout-state">
          <ShieldCheck aria-hidden="true" />
          <h1>ورود برای ادامهٔ خرید</h1>
          <p>
            برای انتخاب آدرس و ثبت سفارش وارد حساب
            کاربری شوید.
          </p>
          <Link
            href="/login?next=%2Fcheckout"
            className="button button--primary"
          >
            ورود به حساب
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  const cart = bootstrap?.cart;
  const addresses =
    bootstrap?.addresses.data ?? [];
  const items = cart?.items ?? [];

  if (!cart || items.length === 0) {
    return (
      <main className="checkout-page">
        <div className="checkout-state">
          <PackageOpen aria-hidden="true" />
          <h1>سبد خرید خالی است</h1>
          <p>
            پیش از ورود به تسویه‌حساب، محصولی به سبد
            اضافه کنید.
          </p>
          <Link
            href="/products"
            className="button button--primary"
          >
            مشاهدهٔ محصولات
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <nav className="checkout-breadcrumbs">
        <Link href="/">خانه</Link>
        <ArrowLeft aria-hidden="true" />
        <Link href="/cart">سبد خرید</Link>
        <ArrowLeft aria-hidden="true" />
        <span>تسویه‌حساب</span>
      </nav>

      <header className="checkout-header">
        <span className="panel-label">
          Checkout
        </span>
        <h1>انتخاب آدرس و مرور سفارش</h1>
        <p>
          در این مرحله فقط اطلاعات ارسال بررسی می‌شود؛
          سفارش و پرداخت پس از تأیید شما ایجاد خواهند شد.
        </p>
      </header>

      {message ? (
        <p className="checkout-message" role="status">
          {message}
        </p>
      ) : null}

      <div className="checkout-layout">
        <section className="checkout-main">
          <div className="checkout-section">
            <div className="checkout-section__header">
              <div>
                <span className="panel-label">
                  مرحلهٔ اول
                </span>
                <h2>آدرس تحویل سفارش</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowForm((current) => !current)
                }
              >
                <Plus aria-hidden="true" />
                افزودن آدرس
              </button>
            </div>

            {addresses.length > 0 ? (
              <div className="checkout-addresses">
                {addresses.map((address) => {
                  const selected =
                    selectedAddressId === address.id;

                  return (
                    <button
                      type="button"
                      key={address.id}
                      className={
                        selected
                          ? 'checkout-address is-selected'
                          : 'checkout-address'
                      }
                      onClick={() =>
                        setSelectedAddressId(address.id)
                      }
                    >
                      <span className="checkout-address__icon">
                        {selected ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <MapPin aria-hidden="true" />
                        )}
                      </span>

                      <span>
                        <strong>
                          {address.title ||
                            `${address.firstName} ${address.lastName}`}
                        </strong>

                        <small>
                          {address.firstName}{' '}
                          {address.lastName} ـ{' '}
                          <bdi dir="ltr">
                            {address.phone}
                          </bdi>
                        </small>

                        <p>
                          {address.state
                            ? `${address.state}، `
                            : ''}
                          {address.city}، {address.street}
                          {address.apartment
                            ? `، ${address.apartment}`
                            : ''}
                        </p>

                        {address.postalCode ? (
                          <small>
                            کد پستی:{' '}
                            <bdi dir="ltr">
                              {address.postalCode}
                            </bdi>
                          </small>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="checkout-empty-note">
                هنوز آدرسی در حساب شما ثبت نشده است.
              </p>
            )}

            {showForm ? (
              <form
                className="checkout-address-form"
                onSubmit={createAddress}
              >
                <label>
                  عنوان آدرس
                  <input
                    value={form.title}
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  نام
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.firstName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  نام خانوادگی
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.lastName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  شماره تماس
                  <input
                    required
                    dir="ltr"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  کشور
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.country}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        country: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  استان
                  <input
                    maxLength={80}
                    value={form.state}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        state: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  شهر
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  کد پستی
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={30}
                    value={form.postalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        postalCode: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="is-wide">
                  نشانی کامل
                  <textarea
                    required
                    minLength={3}
                    maxLength={255}
                    value={form.street}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        street: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="is-wide">
                  پلاک، واحد یا توضیحات تکمیلی
                  <input
                    maxLength={120}
                    value={form.apartment}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        apartment: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="checkout-checkbox is-wide">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                  />
                  این آدرس به‌عنوان آدرس پیش‌فرض ذخیره شود
                </label>

                <div className="checkout-form-actions is-wide">
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={savingAddress}
                  >
                    {savingAddress ? (
                      <LoaderCircle
                        className="is-spinning"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    ثبت آدرس
                  </button>

                  {addresses.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                    >
                      انصراف
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </div>

          <div className="checkout-section">
            <span className="panel-label">
              مرور کالاها
            </span>
            <h2>کالاهای سفارش</h2>

            <div className="checkout-items">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="checkout-item"
                >
                  <div>
                    <strong>
                      {item.product?.name ??
                        'محصول در دسترس نیست'}
                    </strong>
                    <span>
                      تعداد:{' '}
                      {new Intl.NumberFormat(
                        'fa-IR',
                      ).format(item.quantity)}
                    </span>
                  </div>

                  <b>
                    {formatMoney(item.lineTotal)} ریال
                  </b>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="checkout-summary">
          <span className="panel-label">
            خلاصهٔ سفارش
          </span>

          <h2>مبلغ قابل بررسی</h2>

          <dl>
            <div>
              <dt>تعداد کالاها</dt>
              <dd>
                {new Intl.NumberFormat('fa-IR').format(
                  cart.summary.totalItems,
                )}
              </dd>
            </div>

            <div>
              <dt>جمع کالاها</dt>
              <dd>
                {formatMoney(cart.summary.subtotal)} ریال
              </dd>
            </div>

            <div>
              <dt>هزینه ارسال</dt>
              <dd>در مرحلهٔ بعد</dd>
            </div>

            <div className="checkout-summary__total">
              <dt>جمع فعلی</dt>
              <dd>
                {formatMoney(cart.summary.subtotal)} ریال
              </dd>
            </div>
          </dl>

          <CheckoutSubmitButton
            selectedAddressId={selectedAddressId}
          />

          <Link href="/cart">
            بازگشت به سبد خرید
          </Link>
        </aside>
      </div>
    </main>
  );
}
