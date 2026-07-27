import { proxyCartRequest } from '@/lib/server/cart-proxy';

export async function GET() {
  return proxyCartRequest({
    method: 'GET',
    pathname: '/cart',
  });
}

export async function DELETE() {
  return proxyCartRequest({
    method: 'DELETE',
    pathname: '/cart',
  });
}
