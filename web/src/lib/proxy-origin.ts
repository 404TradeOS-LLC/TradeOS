const SAFE_PROXY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldRejectProxyMutation(
  method: string,
  requestUrl: string,
  originHeader: string | null,
  secFetchSiteHeader: string | null = null,
  hasSameSiteProof: boolean = false,
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
  //
  // A same-site cookie is a second proof for the no-Origin case. The redeem
  // route passes whether the request carries a valid-format pending-access
  // cookie: that cookie is httpOnly, SameSite=strict, path-scoped, and cleared
  // on the redeem response, so a cross-site request cannot carry it — but it
  // survives the header-stripping intermediaries on the browser path (proven
  // on staging: the confirm-form POST arrives with neither Origin nor
  // Sec-Fetch-Site, so the header proofs alone can never fire for it). A
  // present Origin stays authoritative over the cookie proof as well.
  return secFetchSiteHeader !== "same-origin" && !hasSameSiteProof;
}
