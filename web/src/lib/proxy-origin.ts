const SAFE_PROXY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldRejectProxyMutation(
  method: string,
  requestUrl: string,
  originHeader: string | null,
  secFetchSiteHeader: string | null = null,
  hasSameSiteProof: boolean = false,
): boolean {
  if (SAFE_PROXY_METHODS.has(method.toUpperCase())) return false;
  // The literal string "null" is the serialized opaque origin: browsers send
  // `Origin: null` on a POST when the source page suppresses its referrer
  // (the confirm flow declares Referrer-Policy: no-referrer, so Chrome sends
  // exactly this on the legitimate confirm-form POST — proven in a real
  // Chromium A/B). It carries no origin information, so it is treated as a
  // missing Origin and falls through to the proofs below; it is never
  // authoritative. A present, parseable Origin stays authoritative.
  if (originHeader && originHeader !== "null") {
    try {
      return new URL(originHeader).origin !== new URL(requestUrl).origin;
    } catch {
      return true;
    }
  }

  // No (usable) Origin header: a same-origin browser navigation still proves
  // its origin through Sec-Fetch-Site, a forbidden header that websites
  // cannot forge. The confirm-form POST is the case this exists for: the
  // confirm flow declares Referrer-Policy: no-referrer, so Chrome sends
  // `Origin: null` on it (proven in a real Chromium A/B against the live
  // app: the POST carries Origin "null", Sec-Fetch-Site: same-origin, and the
  // valid-format pending-access cookie — the earlier "both headers stripped"
  // theory was wrong; curl cannot reproduce referrer-policy Origin
  // serialization). A present, parseable Origin stays authoritative: a
  // mismatched Origin is rejected even when Sec-Fetch-Site claims
  // same-origin. Callers that do not pass Sec-Fetch-Site keep the previous
  // behavior: a missing Origin is rejected.
  //
  // A same-site cookie is a second proof for the no-Origin case. The redeem
  // route passes whether the request carries a valid-format pending-access
  // cookie: that cookie is httpOnly, SameSite=strict, path-scoped, and
  // cleared on the redeem response, so a cross-site request cannot carry it.
  // A present Origin stays authoritative over the cookie proof as well.
  return secFetchSiteHeader !== "same-origin" && !hasSameSiteProof;
}
