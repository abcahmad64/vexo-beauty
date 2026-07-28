import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/profile`,
    timeoutMs: 40_000,
  });
}
