import { AdminCustomerDetailScreen } from '@/components/admin/admin-customer-detail-screen';

type PageProps = {
  params: Promise<{
    customerId: string;
  }>;
};

export default async function AdminCustomerDetailPage({
  params,
}: PageProps) {
  const { customerId } = await params;

  return (
    <AdminCustomerDetailScreen
      customerId={customerId}
    />
  );
}
