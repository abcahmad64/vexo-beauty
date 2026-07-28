import type { Metadata } from 'next';

import { AdminProductDetailScreen } from '@/components/admin/admin-product-detail-screen';

type AdminProductDetailPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export const metadata: Metadata = {
  title: 'جزئیات محصول',
};

export default async function AdminProductDetailPage({
  params,
}: AdminProductDetailPageProps) {
  const { productId } = await params;

  return (
    <AdminProductDetailScreen
      productId={productId}
    />
  );
}
