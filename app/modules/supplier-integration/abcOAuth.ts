import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { SANDBOX_AUTHORIZE_URL, SANDBOX_TOKEN_URL } from "./abcSupply";

/**
 * User-present ABC Supply sandbox OAuth reauthorization (issue #711).
 *
 * ABC requires user-authorized access for third-party customer-specific
 * pricing, so a fresh authorization_code grant is the only way to mint a
 * valid refresh token once the stored one is lost or rotated away. This
 * module implements the authorize/redirect/callback handshake:
 *
 *  1. POST /abc/oauth/authorize (owner/admin + costbook.manage) creates a
 *     short-lived, single-use state row bound to the initiating tenant
 *     session and browser, and returns the ABC authorize URL.
 *  2. The founder's browser completes authorization at ABC, which redirects
 *     to the allowlisted callback with ?code=...&state=....
 *  3. GET /abc/oauth/callback verifies the browser-binding cookie, consumes
 *     the state exactly once, exchanges the code server-side (the client
 *     secret never leaves the backend), and persists the refresh token
 *     through abcSupplyRefreshTokenStore.
 *
 * The state token is the callback credential: only its HMAC-SHA256 is
 * stored, it expires after ABC_OAUTH_STATE_TTL_SECONDS, and replaying it
 * returns nothing. The callback is additionally bound to the browser that
 * started the flow (RFC 6749 section 10.12): a short-lived httpOnly cookie
 * carries a random binding secret whose HMAC is stored in the state row, so
 * a stolen authorize URL cannot be completed from another browser. No raw
 * codes, access tokens, refresh tokens, secrets, or provider response
 * bodies are ever logged.
 */

/** Allowlisted OAuth callback. Must match the URI registered in the ABC Developer Portal. */
export const ABC_OAUTH_CALLBACK_URL =
  "https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback";

/** Founder-facing landing page after the provider redirects back. */
export const ABC_OAUTH_SETTINGS_RETURN_URL = "https://app.404tradeos.com/settings";

export const ABC_OAUTH_SCOPES = "pricing.read offline_access";

/** Authorization states live 10 minutes and are consumed exactly once. */
export const ABC_OAUTH_STATE_TTL_SECONDS = 10 * 60;

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

const BROWSER_COOKIE_ENC_ALGO = "aes-256-gcm";
const BROWSER_COOKIE_IV_BYTES = 12;

function browserCookieKey(): Buffer {
  // Derive a stable 32-byte key from existing server secret material.
  // This avoids introducing new required env vars while keeping keying
  // server-side only.
  return createHash("sha256")
    .update(oauthStateHmacKey())
    .update(":browser-cookie:v1")
    .digest();
}

function encryptBrowserCookieValue(plainText: string): string {
  const iv = randomBytes(BROWSER_COOKIE_IV_BYTES);
  const cipher = createCipheriv(BROWSER_COOKIE_ENC_ALGO, browserCookieKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function decryptBrowserCookieValue(encoded: string): string | null {
  try {
    const payload = Buffer.from(encoded, "base64url");
    if (payload.length <= BROWSER_COOKIE_IV_BYTES + 16) return null;
    const iv = payload.subarray(0, BROWSER_COOKIE_IV_BYTES);
    const tag = payload.subarray(BROWSER_COOKIE_IV_BYTES, BROWSER_COOKIE_IV_BYTES + 16);
    const ciphertext = payload.subarray(BROWSER_COOKIE_IV_BYTES + 16);
    const decipher = createDecipheriv(BROWSER_COOKIE_ENC_ALGO, browserCookieKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** 256-bit cryptographically random OAuth state token. */
export function generateOAuthState(): string {
  return base64Url(randomBytes(32));
}

/** 256-bit cryptographically random browser-binding secret (never leaves the cookie). */
export function generateBrowserBinding(): string {
  return base64Url(randomBytes(32));
}

/** PKCE S256 pair for the authorization_code exchange (RFC 7636 mandates SHA-256 here). */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier, "utf8").digest());
  return { verifier, challenge };
}

/** Environment variable holding the server-side HMAC key for OAuth token hashes. */
export const ABC_OAUTH_STATE_HMAC_SECRET_ENV = "ABC_OAUTH_STATE_HMAC_SECRET";

function loadStateHmacSecret(explicitSecret?: string): string {
  const secret = explicitSecret ?? process.env[ABC_OAUTH_STATE_HMAC_SECRET_ENV]?.trim();
  if (!secret) {
    throw new Error("ABC OAuth state HMAC secret is not configured");
  }
  return secret;
}

/** True when the HMAC secret is configured (fail-closed check for the authorize path). */
export function isOAuthStateHmacConfigured(): boolean {
  return Boolean(process.env[ABC_OAUTH_STATE_HMAC_SECRET_ENV]?.trim());
}

export type OAuthTokenHashPurpose = "state" | "browser-binding";

/**
 * HMAC-SHA256 of an OAuth token for at-rest storage, domain-separated by
 * purpose. Keyed hashing — not a bare SHA-256 — so a database read alone
 * can never yield a forgeable token, and static analysis does not misread
 * this as password hashing. The key comes from
 * ABC_OAUTH_STATE_HMAC_SECRET and is never logged.
 */
export function hmacTokenHash(
  value: string,
  purpose: OAuthTokenHashPurpose,
  hmacSecret?: string,
): string {
  return createHmac("sha256", loadStateHmacSecret(hmacSecret))
    .update(`${purpose}:${value}`, "utf8")
    .digest("hex");
}

/** Name of the short-lived browser-binding cookie (RFC 6749 section 10.12). */
export const ABC_OAUTH_BROWSER_COOKIE_NAME = "abc_oauth_browser";

/** Browser-binding cookies live as long as the authorization state. */
export const ABC_OAUTH_BROWSER_COOKIE_MAX_AGE_SECONDS = ABC_OAUTH_STATE_TTL_SECONDS;

/**
 * Cookie domain that is visible to both the web app (which sets the cookie
 * via the authorize response) and the API callback host. Derived from the
 * allowlisted callback URL so it cannot drift to an unrelated domain.
 * Returns undefined outside the production domain (host-only cookie).
 */
export function abcOAuthCookieDomain(requestHostname: string): string | undefined {
  const callbackHost = new URL(ABC_OAUTH_CALLBACK_URL).hostname.toLowerCase();
  const registrable = callbackHost.split(".").slice(-2).join(".");
  const host = requestHostname.toLowerCase().split(":")[0];
  if (host === registrable || host.endsWith(`.${registrable}`)) return registrable;
  return undefined;
}

/**
 * Serializes the browser-binding Set-Cookie value. httpOnly (never readable
 * by JS), Secure, SameSite=Lax (sent on the top-level GET redirect back
 * from ABC), short Max-Age. The value is base64url and therefore
 * cookie-safe without encoding.
 */
export function buildBrowserBindingCookie(browserBinding: string, requestHostname: string): string {
  const protectedValue = encryptBrowserCookieValue(browserBinding);
  const parts = [
    `${ABC_OAUTH_BROWSER_COOKIE_NAME}=${protectedValue}`,
    "Path=/",
    `Max-Age=${ABC_OAUTH_BROWSER_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  const domain = abcOAuthCookieDomain(requestHostname);
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/**
 * Serializes the Set-Cookie value that expires the browser-binding cookie.
 * Same name, Path, and Domain as the binding cookie with Max-Age=0, so the
 * single-use secret does not linger in the browser after the callback.
 */
export function buildClearBrowserBindingCookie(requestHostname: string): string {
  const parts = [
    `${ABC_OAUTH_BROWSER_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  const domain = abcOAuthCookieDomain(requestHostname);
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/**
 * Reads a single cookie value from a raw Cookie header without any
 * middleware dependency (the callback router intentionally runs before the
 * authenticated middleware stack).
 */
export function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim() || null;
      if (!value) return null;
      if (name === ABC_OAUTH_BROWSER_COOKIE_NAME) {
        return decryptBrowserCookieValue(value);
      }
      return value;
    }
  }
  return null;
}

export interface AuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

/**
 * Builds the ABC sandbox authorize URL. The redirect URI is strictly
 * allowlisted: only the registered TradeOS callback is ever emitted, so a
 * caller cannot turn this into an open redirector.
 */
export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  if (input.redirectUri !== ABC_OAUTH_CALLBACK_URL) {
    throw new Error("ABC OAuth redirect URI is not allowlisted");
  }
  const url = new URL(SANDBOX_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ABC_OAUTH_SCOPES);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface OAuthAuthorizationRequest {
  orgId: string;
  userId: string;
  supplierId: string;
}

export interface OAuthCryptoOptions {
  /** Test-only override for ABC_OAUTH_STATE_HMAC_SECRET. Never set from request data. */
  hmacSecret?: string;
}

/**
 * Creates a single-use authorization state bound to the initiating tenant
 * session and browser. Must run inside the request's database session: the
 * create_abc_oauth_state wrapper rejects anything that does not match the
 * active app.user_id/app.org_id. Returns the browser-binding secret so the
 * caller can set it as an httpOnly cookie; the secret itself is never
 * stored, only its HMAC.
 */
export async function createAuthorizationState(
  request: OAuthAuthorizationRequest,
  crypto: OAuthCryptoOptions = {},
): Promise<{ state: string; codeChallenge: string; browserBinding: string }> {
  const state = generateOAuthState();
  const browserBinding = generateBrowserBinding();
  const { verifier, challenge } = generatePkcePair();
  await prisma.$executeRaw(Prisma.sql`
    select tradeos_private.create_abc_oauth_state(
      ${request.orgId}::uuid,
      ${request.userId}::uuid,
      ${request.supplierId}::uuid,
      ${hmacTokenHash(state, "state", crypto.hmacSecret)},
      ${verifier},
      ${ABC_OAUTH_CALLBACK_URL},
      ${hmacTokenHash(browserBinding, "browser-binding", crypto.hmacSecret)},
      ${ABC_OAUTH_STATE_TTL_SECONDS}::integer
    )
  `);
  return { state, codeChallenge: challenge, browserBinding };
}

export interface ConsumedOAuthState {
  orgId: string;
  userId: string;
  supplierId: string;
  codeVerifier: string;
  redirectUri: string;
}

/**
 * Atomically consumes an authorization state exactly once, and only when
 * the presented browser-binding secret matches the one stored at authorize
 * time (RFC 6749 section 10.12). Returns null for unknown, expired,
 * already-consumed, or browser-mismatched states; a mismatch does NOT
 * consume the state, so a legitimate retry from the initiating browser
 * still works and an attacker cannot burn it. Runs on the base client
 * because the OAuth callback carries no tenant session; the SECURITY DEFINER
 * wrapper is the only reader.
 */
export async function consumeAuthorizationState(
  state: string,
  browserBinding: string | null | undefined,
  crypto: OAuthCryptoOptions = {},
): Promise<ConsumedOAuthState | null> {
  if (!browserBinding) return null;
  const rows = await basePrisma.$queryRaw<ConsumedOAuthState[]>(Prisma.sql`
    select
      org_id as "orgId",
      user_id as "userId",
      supplier_id as "supplierId",
      code_verifier as "codeVerifier",
      redirect_uri as "redirectUri"
    from tradeos_private.consume_abc_oauth_state(
      ${hmacTokenHash(state, "state", crypto.hmacSecret)},
      ${hmacTokenHash(browserBinding, "browser-binding", crypto.hmacSecret)}
    )
  `);
  return rows[0] ?? null;
}

const tokenExchangeSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    scope: z.string().optional(),
  })
  .passthrough();

export interface ExchangeCodeInput {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Exchanges an authorization code for tokens, server-side only. Failures are
 * sanitized to the HTTP status: the provider response body is never logged
 * or surfaced, because it can carry error details adjacent to credentials.
 */
export async function exchangeAuthorizationCode(
  input: ExchangeCodeInput,
): Promise<{ refreshToken: string; scope: string | null }> {
  if (input.redirectUri !== ABC_OAUTH_CALLBACK_URL) {
    throw new Error("ABC OAuth redirect URI is not allowlisted");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const response = await (input.fetchFn ?? fetch)(SANDBOX_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
        "utf8",
      ).toString("base64")}`,
    },
    body,
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(`ABC Supply authorization code exchange failed: HTTP ${response.status}`);
  }
  const parsed = tokenExchangeSchema.parse(await response.json());
  return { refreshToken: parsed.refresh_token, scope: parsed.scope ?? null };
}
