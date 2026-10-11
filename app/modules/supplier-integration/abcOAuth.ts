import { createHash, randomBytes } from "node:crypto";
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
 *     session and returns the ABC authorize URL.
 *  2. The founder's browser completes authorization at ABC, which redirects
 *     to the allowlisted callback with ?code=...&state=....
 *  3. GET /abc/oauth/callback consumes the state exactly once, exchanges
 *     the code server-side (the client secret never leaves the backend),
 *     and persists the refresh token through abcSupplyRefreshTokenStore.
 *
 * The state token is the callback credential: only its SHA-256 hash is
 * stored, it expires after ABC_OAUTH_STATE_TTL_SECONDS, and replaying it
 * returns nothing. No raw codes, access tokens, refresh tokens, secrets,
 * or provider response bodies are ever logged.
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

/** 256-bit cryptographically random OAuth state token. */
export function generateOAuthState(): string {
  return base64Url(randomBytes(32));
}

/** PKCE S256 pair for the authorization_code exchange. */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier, "utf8").digest());
  return { verifier, challenge };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

/**
 * Creates a single-use authorization state bound to the initiating tenant
 * session. Must run inside the request's database session: the
 * create_abc_oauth_state wrapper rejects anything that does not match the
 * active app.user_id/app.org_id.
 */
export async function createAuthorizationState(
  request: OAuthAuthorizationRequest,
): Promise<{ state: string; codeChallenge: string }> {
  const state = generateOAuthState();
  const { verifier, challenge } = generatePkcePair();
  await prisma.$executeRaw(Prisma.sql`
    select tradeos_private.create_abc_oauth_state(
      ${request.orgId}::uuid,
      ${request.userId}::uuid,
      ${request.supplierId}::uuid,
      ${sha256Hex(state)},
      ${verifier},
      ${ABC_OAUTH_CALLBACK_URL},
      ${ABC_OAUTH_STATE_TTL_SECONDS}
    )
  `);
  return { state, codeChallenge: challenge };
}

export interface ConsumedOAuthState {
  orgId: string;
  userId: string;
  supplierId: string;
  codeVerifier: string;
  redirectUri: string;
}

/**
 * Atomically consumes an authorization state exactly once. Returns null for
 * unknown, expired, or already-consumed states. Runs on the base client
 * because the OAuth callback carries no tenant session; the SECURITY DEFINER
 * wrapper is the only reader.
 */
export async function consumeAuthorizationState(state: string): Promise<ConsumedOAuthState | null> {
  const rows = await basePrisma.$queryRaw<ConsumedOAuthState[]>(Prisma.sql`
    select
      org_id as "orgId",
      user_id as "userId",
      supplier_id as "supplierId",
      code_verifier as "codeVerifier",
      redirect_uri as "redirectUri"
    from tradeos_private.consume_abc_oauth_state(${sha256Hex(state)})
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
