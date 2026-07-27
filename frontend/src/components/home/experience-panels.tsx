import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

import { ProductGrid } from '@/components/catalog/product-grid';

import type {
  HomeAssistantData,
  ProductSection,
} from '@/types/storefront';

type ExperiencePanelsProps = {
  sections: ProductSection[];
  assistant: HomeAssistantData | null;
};

function sectionPath(section: ProductSection): string {
  if (section.key === 'new_arrivals') {
    return '/products?sort=newest';
  }

  if (section.key === 'discounted') {
    return '/products?hasDiscount=true';
  }

  if (section.key === 'popular') {
    return '/products?sort=popular';
  }

  if (section.key === 'in_stock') {
    return '/products?inStock=true';
  }

  return '/products';
}

function ProductSectionPanel({
  section,
}: {
  section: ProductSection;
}) {
  if (section.products.length === 0) {
    return null;
  }

  return (
    <section
      className="products-panel products-panel--full"
      aria-labelledby={`home-section-${section.key}`}
    >
      <header>
        <div>
          <span className="panel-label">
            محصولات فروشگاه
          </span>

          <h2 id={`home-section-${section.key}`}>
            {section.title}
          </h2>

          {section.description ? (
            <p className="products-panel__description">
              {section.description}
            </p>
          ) : null}
        </div>

        <Link href={sectionPath(section)}>
          مشاهدهٔ همه
          <ArrowLeft aria-hidden="true" />
        </Link>
      </header>

      <ProductGrid products={section.products} />
    </section>
  );
}

export function ExperiencePanels({
  sections,
  assistant,
}: ExperiencePanelsProps) {
  const visibleSections = sections.filter(
    (section) => section.products.length > 0,
  );

  return (
    <>
      {visibleSections.length > 0 ? (
        <div className="home-product-sections">
          {visibleSections.map((section) => (
            <ProductSectionPanel
              key={section.key}
              section={section}
            />
          ))}
        </div>
      ) : null}

      {assistant?.safety.safeOutput ? (
        <section
          className="purchase-advisor-panel"
          aria-labelledby="purchase-advisor-title"
        >
          <div className="purchase-advisor-panel__visual">
            <span />
            <Sparkles aria-hidden="true" />
          </div>

          <div className="purchase-advisor-panel__content">
            <span className="panel-label">
              مشاوره هوشمند خرید
            </span>

            <h2 id="purchase-advisor-title">
              برای انتخاب بهتر، مشورت کنید
            </h2>

            <p>{assistant.answer}</p>

            <Link
              href="/beauty-assistant"
              className="button button--primary"
            >
              شروع مشاوره
              <ArrowLeft aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
