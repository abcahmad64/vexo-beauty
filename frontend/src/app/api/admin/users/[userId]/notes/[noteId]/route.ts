import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    userId: string;
    noteId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  const { userId, noteId } = await params;

  return proxyAdminApiRequest({
    method: 'DELETE',
    pathname:
      `/admin/users/${encodeURIComponent(
        userId.trim(),
      )}/notes/${encodeURIComponent(
        noteId.trim(),
      )}`,
    timeoutMs: 40_000,
  });
}
