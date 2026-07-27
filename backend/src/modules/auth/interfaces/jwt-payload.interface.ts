export interface JwtPayload {
  sub: string;
  sid: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
