import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    productId: string;
    imageId: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  const { productId, imageId } = await params;

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/media/${encodeURIComponent(
        imageId.trim(),
      )}/primary`,
    body: {},
    timeoutMs: 40_000,
  });
}
