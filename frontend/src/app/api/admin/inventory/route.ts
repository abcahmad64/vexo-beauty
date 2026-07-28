import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

const allowedParameters = new Set([
  'page',
  'limit',
  'q',
  'productId',
  'variantId',
  'warehouseId',
  'warehouseCode',
  'stockStatus',
  'includeInactiveWarehouse',
  'createdFrom',
  'createdTo',
  'sortBy',
  'sortDirection',
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

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname:
      `/admin/inventory${query ? `?${query}` : ''}`,
    timeoutMs: 40_000,
  });
}
