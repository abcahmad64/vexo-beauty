import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  return proxyAdminApiRequest({
    method: 'PATCH',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/restore`,
    timeoutMs: 40_000,
  });
}
