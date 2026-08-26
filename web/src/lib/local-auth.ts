export const LOCAL_ACCESS_TOKEN_COOKIE = "tradeos_access_token";
export const LOCAL_REFRESH_TOKEN_COOKIE = "tradeos_refresh_token";

export interface LocalAuthClaims {
  sub: string;
  email?: string;
  orgId?: string;
  role?: string;
  exp?: number;
}

export function decodeLocalAccessToken(token: string): LocalAuthClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as unknown;
    if (!isRecord(claims) || typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return {
      sub: claims.sub,
      ...(typeof claims.email === "string" ? { email: claims.email } : {}),
      ...(typeof claims.orgId === "string" ? { orgId: claims.orgId } : {}),
      ...(typeof claims.role === "string" ? { role: claims.role } : {}),
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

export function isUsableLocalAccessToken(token: string): boolean {
  const claims = decodeLocalAccessToken(token);
  return claims !== null && claims.exp! > Math.floor(Date.now() / 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
