import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  QuickBooksConfig,
  QuickBooksError,
  QuickBooksTokenSet,
} from "./types";

/**
 * Intuit OAuth 2.0 (authorization_code) for the QuickBooks sandbox.
 *
 * Endpoints (Intuit developer docs — sandbox):
 * - authorize: https://appcenter.intuit.com/connect/oauth2
 * - token:     https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 * - revoke:    https://developer.api.intuit.com/v2/oauth2/tokens/revoke
 *
 * Flow:
 *  1. buildAuthorizeUrl() -> operator visits it, picks a sandbox company,
 *     approves the consent screen.
 *  2. Intuit redirects to redirectUri with ?code=&realmId=&state=.
 *  3. exchangeCodeForTokens() trades the code for access + refresh tokens.
 *  4. QuickBooksAuth caches the access token and refreshes it with a margin
 *     before expiry. When the refresh token rotates, onRefreshTokenRotated
 *     fires so the operator can persist the new value.
 *
 * The client secret is never hardcoded: it arrives via QuickBooksConfig,
 * which loadQuickBooksConfig() builds from environment variables.
 */

export const INTUIT_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const INTUIT_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

/** Scopes for accounting + payments + OpenID profile. */
export const QUICKBOOKS_SCOPES = [
  "com.intuit.quickbooks.accounting",
  "com.intuit.quickbooks.payment",
  "openid",
  "profile",
  "email",
  "phone",
  "address",
].join(" ");

const TOKEN_EXPIRY_MARGIN_MS = 60_000;

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    token_type: z.string().optional(),
  })
  .passthrough();

export interface AuthorizeUrlInput {
  state?: string;
  scopes?: string;
}

/**
 * Builds the Intuit consent URL. The caller generates/persists `state`
 * (CSRF) — a random default is provided when omitted — and must verify it
 * matches on the redirect back before exchanging the code.
 */
export function buildAuthorizeUrl(
  config: Pick<QuickBooksConfig, "clientId" | "redirectUri">,
  input: AuthorizeUrlInput = {},
): { url: string; state: string } {
  const state = input.state ?? randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: input.scopes ?? QUICKBOOKS_SCOPES,
    state,
  });
  return { url: `${INTUIT_AUTHORIZE_URL}?${params.toString()}`, state };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

async function parseTokenResponse(response: Response): Promise<QuickBooksTokenSet> {
  if (!response.ok) {
    throw new QuickBooksError(
      `Intuit token endpoint returned HTTP ${response.status}`,
      "token_request_failed",
      response.status,
    );
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new QuickBooksError("Intuit token endpoint returned invalid JSON", "token_bad_response");
  }
  const parsed = tokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new QuickBooksError("Intuit token response failed validation", "token_bad_response");
  }
  const nowMs = Date.now();
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAtMs: nowMs + parsed.data.expires_in * 1000,
    realmId: "",
  };
}

/**
 * Step 2 of the flow: exchange the authorization `code` (from the redirect)
 * for tokens. Throws unless `state` matches the value issued in step 1.
 */
export async function exchangeCodeForTokens(
  config: QuickBooksConfig,
  code: string,
  realmId: string,
  state: string,
  expectedState: string,
  fetchFn: typeof fetch = fetch,
): Promise<QuickBooksTokenSet> {
  if (!state || state !== expectedState) {
    throw new QuickBooksError("OAuth state mismatch — possible CSRF", "state_mismatch");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const response = await fetchFn(INTUIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: basicAuthHeader(config.clientId, config.clientSecret),
      accept: "application/json",
    },
    body,
  });
  const tokens = await parseTokenResponse(response);
  return { ...tokens, realmId };
}

export interface QuickBooksAuthHooks {
  /** Called when the token endpoint rotates the refresh token. Persist it. */
  onRefreshTokenRotated?: (refreshToken: string) => void;
}

/**
 * Ongoing auth for API calls: caches the access token and refreshes it
 * ahead of expiry via the refresh_token grant.
 */
export class QuickBooksAuth {
  private cached: { accessToken: string; expiresAtMs: number } | null = null;
  private refreshToken: string;

  constructor(
    private readonly config: QuickBooksConfig,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly hooks: QuickBooksAuthHooks = {},
  ) {
    this.refreshToken = config.refreshToken;
  }

  async getAccessToken(): Promise<string> {
    const nowMs = this.now();
    if (this.cached && this.cached.expiresAtMs - TOKEN_EXPIRY_MARGIN_MS > nowMs) {
      return this.cached.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });
    const response = await this.fetchFn(INTUIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicAuthHeader(this.config.clientId, this.config.clientSecret),
        accept: "application/json",
      },
      body,
    });
    const tokens = await parseTokenResponse(response);
    this.cached = { accessToken: tokens.accessToken, expiresAtMs: tokens.expiresAtMs };
    if (tokens.refreshToken !== this.refreshToken) {
      this.refreshToken = tokens.refreshToken;
      this.hooks.onRefreshTokenRotated?.(tokens.refreshToken);
    }
    return tokens.accessToken;
  }

  /** Revokes the current refresh token. Best-effort; logs nothing sensitive. */
  async revoke(fetchFn: typeof fetch = this.fetchFn): Promise<void> {
    await fetchFn(INTUIT_REVOKE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicAuthHeader(this.config.clientId, this.config.clientSecret),
        accept: "application/json",
      },
      body: new URLSearchParams({ token: this.refreshToken }),
    }).catch(() => undefined);
  }
}
