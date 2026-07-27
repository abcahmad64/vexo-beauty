'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Phone,
  RotateCcw,
} from 'lucide-react';

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

type RequestOtpData = {
  success?: boolean;
  message?: string;
  phone?: string;
  expiresInSeconds?: number;
  devOtpCode?: string;
};

type VerifyOtpData = {
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
  sessionId?: string;
};

function normalizeDigits(value: string) {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';

  return value
    .replace(/[۰-۹]/g, (digit) =>
      String(persian.indexOf(digit)),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String(arabic.indexOf(digit)),
    );
}

function normalizePhone(value: string) {
  return normalizeDigits(value)
    .replace(/[^\d+]/g, '')
    .slice(0, 14);
}

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<'phone' | 'code' | 'done'>(
    'phone',
  );
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const normalizedPhone = useMemo(
    () => normalizePhone(phone),
    [phone],
  );

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedPhone = window.sessionStorage.getItem(
        'vexo_customer_otp_phone',
      );

      const storedExpiresAt = Number(
        window.sessionStorage.getItem(
          'vexo_customer_otp_expires_at',
        ) ?? 0,
      );

      const storedDevOtpCode =
        window.sessionStorage.getItem(
          'vexo_customer_dev_otp',
        );

      const secondsLeft = Math.max(
        0,
        Math.ceil((storedExpiresAt - Date.now()) / 1000),
      );

      if (storedPhone && secondsLeft > 0) {
        setPhone(storedPhone);
        setRemainingSeconds(secondsLeft);
        setDevOtpCode(storedDevOtpCode);
        setStep('code');
      }
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) =>
        current > 0 ? current - 1 : 0,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  async function requestOtp() {
    if (pending || remainingSeconds > 0) {
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        '/api/customer-auth/request-otp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: normalizedPhone,
          }),
        },
      );

      const payload = (await response.json()) as
        ApiEnvelope<RequestOtpData> &
        RequestOtpData;

      const otpData =
        payload.data &&
        typeof payload.data === 'object'
          ? payload.data
          : payload;

      if (response.status === 429) {
        setRemainingSeconds((current) =>
          Math.max(current, 60),
        );

        setError(
          payload.message ||
            'لطفاً کمی صبر کنید و دوباره تلاش کنید.',
        );

        return;
      }

      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.message ||
            'ارسال کد تأیید انجام نشد.',
        );
      }

      setRemainingSeconds(
        typeof otpData.expiresInSeconds === 'number'
          ? otpData.expiresInSeconds
          : 120,
      );

      setDevOtpCode(
        typeof otpData.devOtpCode === 'string'
          ? otpData.devOtpCode
          : null,
      );

      const expiresInSeconds =
        typeof otpData.expiresInSeconds === 'number'
          ? otpData.expiresInSeconds
          : 120;

      const receivedPhone =
        typeof otpData.phone === 'string'
          ? otpData.phone
          : normalizedPhone;

      const receivedDevOtpCode =
        typeof otpData.devOtpCode === 'string'
          ? otpData.devOtpCode
          : null;

      window.sessionStorage.setItem(
        'vexo_customer_otp_phone',
        receivedPhone,
      );

      window.sessionStorage.setItem(
        'vexo_customer_otp_expires_at',
        String(Date.now() + expiresInSeconds * 1000),
      );

      if (receivedDevOtpCode) {
        window.sessionStorage.setItem(
          'vexo_customer_dev_otp',
          receivedDevOtpCode,
        );
      } else {
        window.sessionStorage.removeItem(
          'vexo_customer_dev_otp',
        );
      }

      setPhone(receivedPhone);
      setRemainingSeconds(expiresInSeconds);
      setDevOtpCode(receivedDevOtpCode);

      setMessage(
        payload.message ||
          otpData.message ||
          'کد تأیید ارسال شد.',
      );

      setStep('code');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'ارسال کد تأیید انجام نشد.',
      );
    } finally {
      setPending(false);
    }
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (normalizedPhone.length < 10) {
      setError('شماره موبایل معتبر وارد کنید.');
      return;
    }

    await requestOtp();
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeDigits(code).replace(/\D/g, '');

    if (normalizedCode.length !== 6) {
      setError('کد تأیید باید ۶ رقم باشد.');
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        '/api/customer-auth/verify-otp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: normalizedPhone,
            code: normalizedCode,
          }),
        },
      );

      const payload =
        (await response.json()) as ApiEnvelope<VerifyOtpData>;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || 'کد تأیید معتبر نیست.',
        );
      }

      window.sessionStorage.removeItem(
        'vexo_customer_otp_phone',
      );
      window.sessionStorage.removeItem(
        'vexo_customer_otp_expires_at',
      );
      window.sessionStorage.removeItem(
        'vexo_customer_dev_otp',
      );

      setStep('done');
      setMessage('ورود شما با موفقیت انجام شد.');

      window.setTimeout(() => {
        const requestedPath = new URLSearchParams(
          window.location.search,
        ).get('next');

        const safePath =
          requestedPath?.startsWith('/') &&
          !requestedPath.startsWith('//')
            ? requestedPath
            : '/';

        router.replace(safePath);
      }, 900);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'کد تأیید معتبر نیست.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__topbar">
          <Link href="/" className="auth-card__back">
            بازگشت به صفحهٔ اصلی
            <ArrowLeft aria-hidden="true" />
          </Link>

          <span className="panel-label">حساب کاربری</span>
        </div>

        <h1>
          {step === 'phone'
            ? 'ورود به وکسو'
            : step === 'code'
              ? 'تأیید شماره موبایل'
              : 'ورود موفق'}
        </h1>

        <p className="auth-card__lead">
          {step === 'phone'
            ? 'شماره موبایل خود را وارد کنید.'
            : step === 'code'
              ? `کد ارسال‌شده به ${normalizedPhone} را وارد کنید.`
              : 'در حال بازگشت به صفحهٔ اصلی هستید.'}
        </p>

        {step === 'phone' ? (
          <form onSubmit={submitPhone} className="auth-form">
            <label>
              <span>شماره موبایل</span>

              <div className="auth-input">
                <Phone aria-hidden="true" />

                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(normalizePhone(event.target.value))
                  }
                  placeholder="09123456789"
                  dir="ltr"
                  disabled={pending}
                />
              </div>
            </label>

            <button
              type="submit"
              className="button button--primary auth-submit"
              disabled={pending || remainingSeconds > 0}
            >
              {pending ? (
                <LoaderCircle
                  className="is-spinning"
                  aria-hidden="true"
                />
              ) : (
                <LockKeyhole aria-hidden="true" />
              )}
              دریافت کد ورود
            </button>
          </form>
        ) : null}

        {step === 'code' ? (
          <form onSubmit={verifyOtp} className="auth-form">
            <label>
              <span>کد تأیید</span>

              <div className="auth-input auth-input--code">
                <LockKeyhole aria-hidden="true" />

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      normalizeDigits(event.target.value)
                        .replace(/\D/g, '')
                        .slice(0, 6),
                    )
                  }
                  placeholder="------"
                  dir="ltr"
                  disabled={pending}
                  autoFocus
                />
              </div>
            </label>

            {devOtpCode ? (
              <div className="auth-dev-code">
                کد محیط توسعه:
                <strong>{devOtpCode}</strong>
              </div>
            ) : null}

            <button
              type="submit"
              className="button button--primary auth-submit"
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle
                  className="is-spinning"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              تأیید و ورود
            </button>

            <button
              type="button"
              className="auth-resend"
              disabled={pending || remainingSeconds > 0}
              onClick={requestOtp}
            >
              <RotateCcw aria-hidden="true" />
              {remainingSeconds > 0
                ? `ارسال مجدد تا ${remainingSeconds} ثانیه`
                : 'ارسال مجدد کد'}
            </button>

            <button
              type="button"
              className="auth-change-phone"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
                setMessage(null);
                setDevOtpCode(null);
              }}
            >
              ویرایش شماره موبایل
            </button>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="auth-success">
            <CheckCircle2 aria-hidden="true" />
          </div>
        ) : null}

        {message ? (
          <p className="form-message form-message--success">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="form-message form-message--error">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
