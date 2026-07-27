import type { Metadata } from 'next';

import { PaymentResultScreen } from '@/components/checkout/payment-result-screen';

export const metadata: Metadata = {
  title: 'پرداخت ناموفق | وکسو بیوتی',
  robots: {
    index: false,
    follow: false,
  },
};

type PaymentFailurePageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function valueOf(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function PaymentFailurePage({
  searchParams,
}: PaymentFailurePageProps) {
  const query = await searchParams;

  return (
    <PaymentResultScreen
      success={false}
      paymentId={valueOf(query.paymentId)}
      orderId={valueOf(query.orderId)}
      status={valueOf(query.status)}
    />
  );
}
