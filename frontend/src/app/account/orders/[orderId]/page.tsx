import type { Metadata } from 'next';

import { OrderDetailScreen } from '@/components/account/order-detail-screen';

export const metadata: Metadata = {
  title: 'جزئیات سفارش | وکسو بیوتی',
  robots: {
    index: false,
    follow: false,
  },
};

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { orderId } = await params;

  return (
    <OrderDetailScreen orderId={orderId} />
  );
}
