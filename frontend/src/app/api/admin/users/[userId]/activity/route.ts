import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  const { userId } = await params;
  const incoming = new URL(request.url);
  const rawLimit = incoming.searchParams.get(
    'limit',
  );

  const limit = Math.min(
    Math.max(Number(rawLimit) || 50, 1),
    200,
  );

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/activity?limit=${limit}`,
    timeoutMs: 40_000,
  });
}
