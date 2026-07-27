'use client';

import {
  FormEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  LoaderCircle,
  Send,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

type SuggestedProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  price?: string | null;
  comparePrice?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  availableStock?: number;
};

type AdvisorData = {
  answer?: {
    title?: string;
    message?: string;
    productSuggestions?: SuggestedProduct[];
    nextQuestions?: string[];
    suggestedQuestions?: string[];
    nextActions?: Array<{
      type?: string;
      label?: string;
      productSlug?: string;
    }>;
    guardrails?: string[];
  };
  products?: SuggestedProduct[];
  suggestedQuestions?: string[];
  source?: string;
  safety?: {
    safeOutput?: boolean;
    internalDataBlocked?: boolean;
    dataScope?: string;
  };
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

type ConsultationEntry = {
  id: string;
  question: string;
  answer: string;
  products: SuggestedProduct[];
  suggestedQuestions: string[];
};

function formatPrice(value?: string | null) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return `${new Intl.NumberFormat('fa-IR').format(
    numericValue,
  )} ریال`;
}

export default function BeautyAssistantPage() {
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<ConsultationEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const conversationContext = useMemo(
    () =>
      entries
        .slice(-4)
        .map(
          (entry) =>
            `مشتری: ${entry.question}\nمشاور: ${entry.answer}`,
        )
        .join('\n\n')
        .slice(0, 3000),
    [entries],
  );

  async function submitQuestion(
    event?: FormEvent<HTMLFormElement>,
    suggestedQuestion?: string,
  ) {
    event?.preventDefault();

    const normalizedQuestion = (
      suggestedQuestion ?? question
    ).trim();

    if (normalizedQuestion.length < 2 || pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/purchase-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: normalizedQuestion,
          conversationContext,
        }),
      });

      const payload =
        (await response.json()) as ApiEnvelope<AdvisorData>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.message || 'پاسخ مشاوره دریافت نشد.',
        );
      }

      const data = payload.data;

      if (
        data.safety?.safeOutput !== true ||
        typeof data.answer?.message !== 'string'
      ) {
        throw new Error(
          'پاسخ ایمن و قابل نمایش دریافت نشد.',
        );
      }

      const products =
        data.answer.productSuggestions ??
        data.products ??
        [];

      const suggestedQuestions = Array.from(
        new Set([
          ...(data.answer.nextQuestions ?? []),
          ...(data.answer.suggestedQuestions ?? []),
          ...(data.suggestedQuestions ?? []),
        ]),
      ).slice(0, 6);

      setEntries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          question: normalizedQuestion,
          answer: data.answer?.message ?? '',
          products,
          suggestedQuestions,
        },
      ]);

      setQuestion('');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'پاسخ مشاوره دریافت نشد.',
      );
    } finally {
      setPending(false);
    }
  }

  const latestEntry = entries.at(-1);

  return (
    <main className="advisor-page">
      <header className="advisor-header">
        <div>
          <Link href="/" className="catalog-page__back">
            بازگشت به صفحهٔ اصلی
            <ArrowLeft aria-hidden="true" />
          </Link>

          <span className="panel-label">وکسو بیوتی</span>

          <h1>مشاوره هوشمند خرید</h1>

          <p>
            نیاز، بودجه یا محصول موردنظر خود را بنویسید تا پاسخ و
            پیشنهادها بر اساس اطلاعات واقعی فروشگاه آماده شوند.
          </p>
        </div>

        <div className="advisor-header__visual" aria-hidden="true">
          <span />
          <Sparkles />
        </div>
      </header>

      <section className="advisor-workspace">
        <form
          ref={formRef}
          className="advisor-form"
          onSubmit={(event) => submitQuestion(event)}
        >
          <label htmlFor="advisor-question">
            نیاز یا پرسش شما
          </label>

          <textarea
            id="advisor-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="مثلاً برای هدیه دنبال یک محصول مناسب با بودجه مشخص هستم..."
            maxLength={2000}
            disabled={pending}
          />

          <div className="advisor-form__footer">
            <button
              type="submit"
              className="button button--primary"
              disabled={pending || question.trim().length < 2}
            >
              {pending ? (
                <LoaderCircle
                  className="is-spinning"
                  aria-hidden="true"
                />
              ) : (
                <Send aria-hidden="true" />
              )}
              دریافت مشاوره
            </button>

            <span>
              {new Intl.NumberFormat('fa-IR').format(
                question.length,
              )}
              /۲۰۰۰
            </span>
          </div>
        </form>

        {entries.length === 0 ? (
          <div className="advisor-empty">
            <Sparkles aria-hidden="true" />
            <h2>مشاوره از سؤال شما شروع می‌شود</h2>
            <p>
              هرچه نیاز خود را دقیق‌تر بیان کنید، نتیجه کاربردی‌تر
              خواهد بود.
            </p>
          </div>
        ) : (
          <div className="advisor-results">
            {entries.map((entry) => (
              <article key={entry.id} className="advisor-entry">
                <div className="advisor-entry__question">
                  <span>پرسش شما</span>
                  <p>{entry.question}</p>
                </div>

                <div className="advisor-entry__answer">
                  <span>مشاوره هوشمند خرید</span>
                  <p>{entry.answer}</p>
                </div>

                {entry.products.length > 0 ? (
                  <div className="advisor-products">
                    {entry.products.map((product) => {
                      const price = formatPrice(product.price);

                      return (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          className="advisor-product"
                        >
                          <span className="advisor-product__icon">
                            <ShoppingBag aria-hidden="true" />
                          </span>

                          <span className="advisor-product__content">
                            {product.brandName ? (
                              <small>{product.brandName}</small>
                            ) : null}

                            <strong>{product.name}</strong>

                            {product.shortDescription ? (
                              <p>{product.shortDescription}</p>
                            ) : null}

                            {price ? <b>{price}</b> : null}
                          </span>

                          <ArrowLeft aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {latestEntry?.suggestedQuestions.length ? (
          <div className="advisor-suggestions">
            <span>ادامهٔ مشاوره</span>

            <div>
              {latestEntry.suggestedQuestions.map(
                (suggestedQuestion) => (
                  <button
                    type="button"
                    key={suggestedQuestion}
                    disabled={pending}
                    onClick={() =>
                      submitQuestion(
                        undefined,
                        suggestedQuestion,
                      )
                    }
                  >
                    {suggestedQuestion}
                  </button>
                ),
              )}
            </div>
          </div>
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
