import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    couponId: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  const { couponId } = await params;

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/coupons/${encodeURIComponent(
        couponId.trim(),
      )}/expire`,
    timeoutMs: 40_000,
  });
}
