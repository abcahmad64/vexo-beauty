import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

const allowedKeys = new Set([
  'page',
  'limit',
  'q',
  'userId',
  'email',
  'orderNumber',
  'trackingNumber',
  'status',
  'paymentStatus',
  'paymentMethod',
  'totalMin',
  'totalMax',
  'hasTrackingNumber',
  'hasInvoice',
  'includeDeleted',
  'createdFrom',
  'createdTo',
  'shippedFrom',
  'shippedTo',
  'deliveredFrom',
  'deliveredTo',
  'sortBy',
  'sortDirection',
]);

export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const outgoing = new URLSearchParams();

  for (const [key, value] of incoming.entries()) {
    if (
      allowedKeys.has(key) &&
      value.trim().length > 0
    ) {
      outgoing.set(key, value.trim());
    }
  }

  const page = Math.max(
    1,
    Number(outgoing.get('page') ?? 1),
  );

  const limit = Math.min(
    200,
    Math.max(
      1,
      Number(outgoing.get('limit') ?? 20),
    ),
  );

  outgoing.set(
    'page',
    String(Number.isFinite(page) ? page : 1),
  );

  outgoing.set(
    'limit',
    String(Number.isFinite(limit) ? limit : 20),
  );

  const query = outgoing.toString();

  return proxyAdminApiRequest({
    method: 'GET',
    pathname: `/admin/orders${query ? `?${query}` : ''}`,
    timeoutMs: 40_000,
  });
}
