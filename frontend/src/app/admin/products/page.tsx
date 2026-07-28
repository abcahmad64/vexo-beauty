import type { Metadata } from 'next';

import { AdminProductsScreen } from '@/components/admin/admin-products-screen';

export const metadata: Metadata = {
  title: 'مدیریت محصولات',
};

export default function AdminProductsPage() {
  return <AdminProductsScreen />;
}
