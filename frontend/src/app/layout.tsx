import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vexobeauty.ir',
  ),
  title: {
    default: 'وکسو بیوتی | زیبایی هوشمند و شخصی‌سازی‌شده',
    template: '%s | وکسو بیوتی',
  },
  description:
    'تجربه‌ای هوشمند و متفاوت برای کشف محصولات آرایشی، مراقبتی، عطر و زیبایی.',
  applicationName: 'Vexo Beauty',
  keywords: [
    'وکسو بیوتی',
    'لوازم آرایشی',
    'مراقبت پوست',
    'مراقبت مو',
    'عطر',
    'مشاوره هوشمند زیبایی',
  ],
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'Vexo Beauty',
    title: 'وکسو بیوتی | زیبایی هوشمند',
    description:
      'تجربه‌ای هوشمند و شخصی‌سازی‌شده برای کشف محصولات زیبایی.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050506',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
