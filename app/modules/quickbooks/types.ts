/**
 * QuickBooks Online sandbox integration — shared types.
 *
 * Sandbox-only by design: every host below is a hardcoded Intuit sandbox
 * constant. There are no production hosts in this module, so nothing here
 * can accidentally run against a production QuickBooks company.
 */

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  /** Redirect URI registered on the Intuit app (must match the portal entry). */
  redirectUri: string;
  /** Refresh token minted from a completed authorization_code flow. */
  refreshToken: string;
  /** Sandbox company realmId the refresh token was issued for. */
  realmId: string;
}

/** Returns null when the QuickBooks sandbox integration is not configured. */
export function loadQuickBooksConfig(
  env: NodeJS.ProcessEnv = process.env,
): QuickBooksConfig | null {
  const clientId = env.QUICKBOOKS_SANDBOX_CLIENT_ID?.trim();
  const clientSecret = env.QUICKBOOKS_SANDBOX_CLIENT_SECRET?.trim();
  const redirectUri = env.QUICKBOOKS_SANDBOX_REDIRECT_URI?.trim();
  const refreshToken = env.QUICKBOOKS_SANDBOX_REFRESH_TOKEN?.trim();
  const realmId = env.QUICKBOOKS_SANDBOX_REALM_ID?.trim();
  if (!clientId || !clientSecret || !redirectUri || !refreshToken || !realmId) return null;
  return { clientId, clientSecret, redirectUri, refreshToken, realmId };
}

export interface QuickBooksTokenSet {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token should be considered expired. */
  expiresAtMs: number;
  realmId: string;
}

export interface QuickBooksCompanyInfo {
  companyName: string;
  legalName?: string;
  companyAddr?: Record<string, string>;
  email?: string;
  webAddr?: string;
}

export interface QuickBooksUserInfo {
  sub: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  phoneNumber?: string;
}

export interface QuickBooksChargeRequest {
  amount: string;
  currency?: string;
  card?: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    name?: string;
  };
}

export interface QuickBooksChargeResult {
  id: string;
  status: string;
  amount?: string;
  currency?: string;
}

export class QuickBooksError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly intuitErrorCode?: string,
  ) {
    super(message);
    this.name = "QuickBooksError";
  }
}
