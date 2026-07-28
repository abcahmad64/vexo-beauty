import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type AdminOrderTimelineRouteProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: AdminOrderTimelineRouteProps,
) {
  const { orderId } = await params;

  const incomingLimit = Number(
    new URL(request.url).searchParams.get('limit') ?? 100,
  );

  const limit = Number.isFinite(incomingLimit)
    ? Math.min(300, Math.max(1, Math.trunc(incomingLimit)))
    : 100;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/orders/${encodeURIComponent(
        orderId.trim(),
      )}/timeline?limit=${limit}`,
    timeoutMs: 40_000,
  });
}
