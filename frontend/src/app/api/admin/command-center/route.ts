import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);

  const chartDays = Math.min(
    90,
    Math.max(
      1,
      Number(
        url.searchParams.get('chartDays') ?? 30,
      ),
    ),
  );

  const actionLimit = Math.min(
    30,
    Math.max(
      1,
      Number(
        url.searchParams.get('actionLimit') ?? 10,
      ),
    ),
  );

  const timelineLimit = Math.min(
    100,
    Math.max(
      1,
      Number(
        url.searchParams.get('timelineLimit') ??
          20,
      ),
    ),
  );

  const params = new URLSearchParams({
    chartDays: String(chartDays),
    actionLimit: String(actionLimit),
    timelineLimit: String(timelineLimit),
  });

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/command-center?${params.toString()}`,
    timeoutMs: 45_000,
  });
}
