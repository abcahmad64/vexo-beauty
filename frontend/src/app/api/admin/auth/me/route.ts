import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

export async function GET() {
  return proxyAdminApiRequest({
    method: 'GET',
    pathname: '/auth/me',
  });
}
