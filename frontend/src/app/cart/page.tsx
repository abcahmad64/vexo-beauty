import type { Metadata } from 'next';

import { CartScreen } from '@/components/cart/cart-screen';

export const metadata: Metadata = {
  title: 'سبد خرید | وکسو بیوتی',
  description: 'مشاهده و مدیریت سبد خرید وکسو بیوتی',
};

export default function CartPage() {
  return <CartScreen />;
}
