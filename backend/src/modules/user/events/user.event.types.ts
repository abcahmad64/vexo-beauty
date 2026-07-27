export enum UserEventType {
  CREATED = 'user.created',
  PROFILE_UPDATED = 'user.profile_updated',
  UPDATED = 'user.updated',
  PASSWORD_CHANGED = 'user.password_changed',
  PASSWORD_RESET = 'user.password_reset',
  STATUS_CHANGED = 'user.status_changed',
  SOFT_DELETED = 'user.soft_deleted',
  RESTORED = 'user.restored',
  SESSIONS_REVOKED = 'user.sessions_revoked',
}
