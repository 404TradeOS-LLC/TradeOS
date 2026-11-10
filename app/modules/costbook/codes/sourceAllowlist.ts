/**
 * Constrained fetch for the governed Codes & Permits source pipeline
 * (issue #946, TODO 3).
 *
 * SSRF policy — explicit allowlist, enforced BEFORE any network call and
 * re-enforced on every redirect hop:
 *
 * - Only `https:` URLs.
 * - Only the issuer's own hosts: `vigocounty.in.gov` and `in.gov`, each
 *   including subdomains. That covers the three verified first sources:
 *   Vigo County (`www.vigocounty.in.gov`), IDHS (`www.in.gov/dhs/...`)
 *   and INDOT (`www.in.gov/indot/...`, plus INDOT-owned `*.indot.in.gov`
 *   hosts such as `erms.indot.in.gov`). No other host is fetchable — not
 *   `in.gov.evil.com`, not `evil-in.gov`, not an IP literal, not localhost.
 * - No credentials in the URL, no non-443 port.
 * - Redirects are followed manually, at most 3 hops, with the allowlist
 *   re-checked on every hop. A redirect off the allowlist is refused, not
 *   followed.
 * - 15 s per-request timeout, 5 MiB response cap. The bytes are hashed
 *   (sha256) and discarded — full code text is never stored, parsed, or
 *   logged, so copyrighted model-code text cannot leak into the database.
 *
 * Known limitation (documented, not hidden): the allowlist is DNS-name
 * based. This module does not pin DNS resolutions, so it does not defend
 * against a compromised official-host DNS record (DNS rebinding). The
 * allowlist still confines every fetch to issuer-owned names; pinning
 * would be a separate hardening slice.
 *
 * There is NO background fetch, scraper, or cron in this module. Fetching
 * happens only inside an explicit, authenticated, human-triggered ingest
 * call (see `./ingestion.ts`). A scheduled fetcher is a separate,
 * separately-approved slice.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { ApiError } from "../../../backend/middleware/errorHandler";

/**
 * Exact official hosts, each including its subdomains. `vigocounty.in.gov`
 * is listed explicitly even though it is also a subdomain of `in.gov`,
 * so the county issuer is visible in the policy instead of implied.
 */
export const OFFICIAL_CODES_SOURCE_HOSTS = ["vigocounty.in.gov", "in.gov"] as const;

/** Per-request timeout for official-source fetches. */
export const CODES_SOURCE_FETCH_TIMEOUT_MS = 15_000;
/** Maximum official-source response body accepted for hashing. */
export const CODES_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
/** Maximum redirect hops followed, each re-validated against the allowlist. */
export const CODES_SOURCE_MAX_REDIRECTS = 3;

const USER_AGENT = "TradeOS-Costbook/1.0 (Codes & Permits governed ingestion)";

/** sha256 hex of the exact fetched bytes. */
export function computeSourceHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Constant-time hash equality, so a comparison never leaks prefix length by timing.
 * A NULL stored hash (TODO 2 seed rows, unhashed until first governed fetch)
 * never equals a fetched hash.
 */
export function sourceHashesEqual(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return OFFICIAL_CODES_SOURCE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Validate a caller-supplied source URL against the SSRF policy.
 * Returns the parsed URL on success; throws a 400 `ApiError` (no fetch is
 * attempted) on any violation.
 */
export function assertOfficialSourceUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, "sourceUrl must be a valid absolute URL");
  }
  if (url.protocol !== "https:") {
    throw new ApiError(400, "sourceUrl must use https");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ApiError(400, "sourceUrl must not contain credentials");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "" || isIP(hostname) !== 0) {
    throw new ApiError(400, "sourceUrl must name an allowlisted official host, not an IP address");
  }
  if (url.port !== "" && url.port !== "443") {
    throw new ApiError(400, "sourceUrl must not specify a non-standard port");
  }
  if (!isAllowedHost(hostname)) {
    throw new ApiError(
      400,
      `sourceUrl host "${hostname}" is not an allowlisted official source host (${OFFICIAL_CODES_SOURCE_HOSTS.join(", ")}, including subdomains)`,
    );
  }
  if (value.length > 2000) {
    throw new ApiError(400, "sourceUrl is too long");
  }
  return url;
}

/** Non-throwing form of the allowlist check, for callers that only need a boolean. */
export function isOfficialSourceUrl(value: string): boolean {
  try {
    assertOfficialSourceUrl(value);
    return true;
  } catch {
    return false;
  }
}

export interface OfficialSourceFetchResult {
  /** Exact bytes fetched (hashed by the caller, never persisted). */
  bytes: Buffer;
  /** sha256 hex of `bytes`. */
  sourceHash: string;
  /** Number of bytes fetched. */
  fetchedBytes: number;
  /** Final URL after redirects (always allowlisted). */
  finalUrl: string;
  /** Response Content-Type, if the server sent one. */
  contentType: string | null;
}

export interface FetchOfficialSourceOptions {
  /** HTTP client; injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * Fetch one official source URL under the SSRF policy and return its bytes
 * plus sha256 hash. The URL is validated before any network call; every
 * redirect target is validated the same way. The body is streamed with a
 * hard byte cap and is returned only for hashing — callers must not persist
 * it (see `./ingestion.ts`).
 *
 * Throws `ApiError` 502 on fetch failure / non-2xx / oversize body, 504 on
 * timeout. The source URL itself is never logged here.
 */
export async function fetchOfficialSourceBytes(
  sourceUrl: string,
  options: FetchOfficialSourceOptions = {},
): Promise<OfficialSourceFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? CODES_SOURCE_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? CODES_SOURCE_MAX_BYTES;

  let current = assertOfficialSourceUrl(sourceUrl);
  let response: Response | null = null;

  for (let hop = 0; hop <= CODES_SOURCE_MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetchImpl(current.toString(), {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError(504, "Official source fetch timed out");
      }
      throw new ApiError(502, `Official source fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ApiError(502, "Official source redirect had no Location");
      }
      if (hop === CODES_SOURCE_MAX_REDIRECTS) {
        throw new ApiError(502, "Official source redirect limit exceeded");
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new ApiError(502, "Official source redirect Location is not a valid URL");
      }
      // Re-validate the redirect target before following it. A redirect
      // off the allowlist is refused, never followed.
      current = assertOfficialSourceUrl(next.toString());
      // Drain the redirect body before the next hop.
      await response.arrayBuffer().catch(() => undefined);
      continue;
    }
    break;
  }

  if (!response) {
    throw new ApiError(502, "Official source fetch produced no response");
  }
  if (!response.ok) {
    await response.arrayBuffer().catch(() => undefined);
    throw new ApiError(502, `Official source fetch failed with HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) {
      await response.arrayBuffer().catch(() => undefined);
      throw new ApiError(502, "Official source response exceeds the maximum fetch size");
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const body = response.body;
  if (!body) {
    throw new ApiError(502, "Official source response had no body");
  }
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new ApiError(502, "Official source response exceeds the maximum fetch size");
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return {
    bytes,
    sourceHash: computeSourceHash(bytes),
    fetchedBytes: total,
    finalUrl: current.toString(),
    contentType: response.headers.get("content-type"),
  };
}
