export enum AuthEventType {
  USER_REGISTERED = 'auth.user_registered',
  USER_LOGGED_IN = 'auth.user_logged_in',
  TOKEN_REFRESHED = 'auth.token_refreshed',
  USER_LOGGED_OUT = 'auth.user_logged_out',
  ALL_SESSIONS_LOGGED_OUT = 'auth.all_sessions_logged_out',
  SESSION_REVOKED = 'auth.session_revoked',
  LOGIN_FAILED = 'auth.login_failed',
}
