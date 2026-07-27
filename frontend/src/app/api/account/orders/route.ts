import { proxyCustomerApiRequest } from '@/lib/server/customer-api-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);

  const page = Math.max(
    1,
    Number(url.searchParams.get('page') ?? 1),
  );

  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(url.searchParams.get('limit') ?? 10),
    ),
  );

  return proxyCustomerApiRequest({
    method: 'GET',
    pathname: `/orders/my?page=${page}&limit=${limit}`,
  });
}
