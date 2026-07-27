import type { Metadata } from 'next';

import { OrdersScreen } from '@/components/account/orders-screen';

export const metadata: Metadata = {
  title: 'سفارش‌های من | وکسو بیوتی',
  description:
    'مشاهده و پیگیری سفارش‌های حساب کاربری وکسو بیوتی',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrdersPage() {
  return <OrdersScreen />;
}
