export const CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE = "tradeos_customer_portal_pending_access";
export const CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH = "/customer-portal/access";
export const CUSTOMER_PORTAL_PENDING_ACCESS_MAX_AGE_SECONDS = 10 * 60;

export function isValidCustomerPortalAccessToken(token: string | undefined): token is string {
  return typeof token === "string" && token.length >= 40 && token.length <= 128;
}

export function parseCustomerPortalRedemption(value: unknown, now = Date.now()): { token: string; maxAge: number } | null {
  if (!value || typeof value !== "object" || !("sessionToken" in value) || !("expiresAt" in value)) return null;
  const { sessionToken, expiresAt } = value;
  if (typeof sessionToken !== "string" || !/^[A-Za-z0-9_-]{40,128}$/.test(sessionToken) || typeof expiresAt !== "string") return null;
  const maxAge = Math.floor((Date.parse(expiresAt) - now) / 1000);
  return Number.isFinite(maxAge) && maxAge > 0 ? { token: sessionToken, maxAge } : null;
}
