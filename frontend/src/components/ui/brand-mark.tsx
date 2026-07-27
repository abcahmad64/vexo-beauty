import Link from 'next/link';

export function BrandMark() {
  return (
    <Link href="/" className="brand-mark" aria-label="صفحهٔ اصلی وکسو بیوتی">
      <span className="brand-mark__name">وکسو بیوتی</span>
      <span className="brand-mark__tagline">زیبایی هوشمند</span>
    </Link>
  );
}
