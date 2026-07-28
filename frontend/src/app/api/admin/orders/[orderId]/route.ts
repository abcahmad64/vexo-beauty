import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type AdminOrderRouteProps = {
  params: Promise<{
    orderId: string;
  }>;
};

function safeOrderId(value: string) {
  return encodeURIComponent(value.trim());
}

export async function GET(
  _request: Request,
  { params }: AdminOrderRouteProps,
) {
  const { orderId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname: `/admin/orders/${safeOrderId(orderId)}`,
    timeoutMs: 40_000,
  });
}
