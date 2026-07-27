import { proxyCartRequest } from '@/lib/server/cart-proxy';

export async function PATCH() {
  return proxyCartRequest({
    method: 'PATCH',
    pathname: '/cart/refresh-prices',
  });
}
