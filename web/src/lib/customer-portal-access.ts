export const CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE = "tradeos_customer_portal_pending_access";
export const CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH = "/customer-portal/access";
export const CUSTOMER_PORTAL_PENDING_ACCESS_MAX_AGE_SECONDS = 10 * 60;

export function isValidCustomerPortalAccessToken(token: string | undefined): token is string {
  return typeof token === "string" && token.length >= 40 && token.length <= 128;
}
