import type { Metadata } from 'next';

import { CheckoutScreen } from '@/components/checkout/checkout-screen';

export const metadata: Metadata = {
  title: 'تسویه‌حساب | وکسو بیوتی',
  description:
    'انتخاب آدرس و مرور سفارش در وکسو بیوتی',
};

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
