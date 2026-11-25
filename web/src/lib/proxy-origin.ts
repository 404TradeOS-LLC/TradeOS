const SAFE_PROXY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldRejectProxyMutation(
  method: string,
  requestUrl: string,
  originHeader: string | null,
  secFetchSiteHeader: string | null = null,
): boolean {
  if (SAFE_PROXY_METHODS.has(method.toUpperCase())) return false;
  if (originHeader) {
    try {
      return new URL(originHeader).origin !== new URL(requestUrl).origin;
    } catch {
      return true;
    }
  }

  // No Origin header: a same-origin browser navigation still proves its origin
  // through Sec-Fetch-Site, a forbidden header that websites cannot forge.
  // Some browsers and proxies strip Origin on the customer-portal confirm-form
  // POST, which rejected the legitimate redemption as cross-origin even though
  // the request was same-origin. A present Origin stays authoritative: a
  // mismatched Origin is rejected even when Sec-Fetch-Site claims same-origin.
  // Callers that do not pass Sec-Fetch-Site keep the previous behavior: a
  // missing Origin is rejected.
  return secFetchSiteHeader !== "same-origin";
}
