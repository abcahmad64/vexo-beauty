export interface AuthenticatedUserRole {
  id?: string | null;
  name?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  userId: string;
  sub: string;
  sessionId?: string | null;

  email?: string | null;
  phone?: string | null;

  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;

  status: string;

  roleId?: string | null;
  roleName?: string | null;
  role?: AuthenticatedUserRole | null;

  permissions: string[];
}
