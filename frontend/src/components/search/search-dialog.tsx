'use client';

import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { NavigationItem } from '@/types/storefront';

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
  categories: NavigationItem[];
};

export function SearchDialog({
  open,
  onClose,
  categories,
}: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = query.trim();

    if (!normalized) {
      return;
    }

    router.push(
      `/products/search?q=${encodeURIComponent(normalized)}`,
    );
    handleClose();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="search-overlay__backdrop"
            onClick={handleClose}
            aria-label="بستن پنجرهٔ جست‌وجو"
          />

          <motion.section
            className="search-dialog"
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.24 }}
          >
            <form
              className="search-dialog__header"
              onSubmit={submitSearch}
            >
              <Search aria-hidden="true" />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="نام محصول، برند یا دسته‌بندی..."
                aria-label="عبارت جست‌وجو"
              />

              <button
                type="button"
                onClick={handleClose}
                aria-label="بستن جست‌وجو"
              >
                <X aria-hidden="true" />
              </button>
            </form>

            <div className="search-dialog__layout search-dialog__layout--simple">
              <main className="search-dialog__content">
                <h2 id={titleId}>جست‌وجوی محصولات</h2>

                <p className="search-dialog__description">
                  عبارت موردنظر را وارد کنید تا نتایج از جست‌وجوی واقعی
                  کاتالوگ دریافت شوند.
                </p>

                <button
                  type="button"
                  className="button button--primary search-dialog__submit"
                  disabled={!query.trim()}
                  onClick={() => {
                    const normalized = query.trim();

                    if (!normalized) {
                      return;
                    }

                    router.push(
                      `/products/search?q=${encodeURIComponent(normalized)}`,
                    );
                    handleClose();
                  }}
                >
                  مشاهدهٔ نتایج
                  <ArrowLeft aria-hidden="true" />
                </button>

                {categories.length > 0 ? (
                  <nav
                    className="search-dialog__categories"
                    aria-label="دسته‌بندی‌های فعال"
                  >
                    {categories
                      .filter(
                        (category) =>
                          category.stats.productCount > 0,
                      )
                      .slice(0, 8)
                      .map((category) => (
                        <button
                          type="button"
                          key={category.id}
                          onClick={() => {
                            router.push(category.path);
                            handleClose();
                          }}
                        >
                          {category.name}
                        </button>
                      ))}
                  </nav>
                ) : null}
              </main>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
