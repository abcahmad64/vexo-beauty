import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    variantId: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  const { variantId } = await params;

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/product-variants/${encodeURIComponent(
        variantId.trim(),
      )}/activate`,
    body: {},
    timeoutMs: 40_000,
  });
}
