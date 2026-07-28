import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

const allowedParameters = new Set([
  'q',
  'isActive',
  'page',
  'limit',
]);

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const outgoing = new URLSearchParams();

  for (const [key, value] of incoming.searchParams) {
    if (!allowedParameters.has(key)) {
      continue;
    }

    const normalized = value.trim();

    if (normalized) {
      outgoing.set(key, normalized);
    }
  }

  if (!outgoing.has('isActive')) {
    outgoing.set('isActive', 'true');
  }

  if (!outgoing.has('limit')) {
    outgoing.set('limit', '100');
  }

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/inventory/warehouses${
        query ? `?${query}` : ''
      }`,
    timeoutMs: 40_000,
  });
}
