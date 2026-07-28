import type { Metadata } from 'next';

import { AdminOrderDetailScreen } from '@/components/admin/admin-order-detail-screen';

type AdminOrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export const metadata: Metadata = {
  title: 'جزئیات سفارش',
};

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
  const { orderId } = await params;

  return (
    <AdminOrderDetailScreen
      orderId={orderId}
    />
  );
}
