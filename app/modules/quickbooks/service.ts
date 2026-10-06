import { QuickBooksAuth, QuickBooksAuthHooks, buildAuthorizeUrl } from "./oauth";
import { QuickBooksClient } from "./client";
import {
  QuickBooksChargeRequest,
  QuickBooksChargeResult,
  QuickBooksCompanyInfo,
  QuickBooksConfig,
  QuickBooksUserInfo,
  loadQuickBooksConfig,
} from "./types";

/**
 * QuickBooks sandbox service — org-scoped entry point.
 *
 * Wiring contract (follows the supplier-integration module pattern):
 * - services take orgId explicitly and never touch Express request objects;
 * - the integration is a no-op returning null unless all
 *   QUICKBOOKS_SANDBOX_* env vars are present;
 * - tokens live in env (refresh) + memory (access); a production rollout
 *   should persist rotated refresh tokens encrypted per-org in the database.
 *
 * Local runbook:
 *  1. In the Intuit developer portal, add a redirect URI for this app
 *     (e.g. https://app.404tradeos.com/api/quickbooks/oauth/callback)
 *     and copy the client ID/secret from Keys & OAuth.
 *  2. export QUICKBOOKS_SANDBOX_CLIENT_ID / _CLIENT_SECRET /
 *     _REDIRECT_URI (the portal value from step 1).
 *  3. Call startAuthorization() -> visit the returned URL, approve the
 *     consent screen, pick the sandbox company.
 *  4. Intuit redirects with ?code=&realmId=&state= -> pass those to
 *     completeAuthorization() to mint tokens. Store the refresh token as
 *     QUICKBOOKS_SANDBOX_REFRESH_TOKEN and the realmId as
 *     QUICKBOOKS_SANDBOX_REALM_ID.
 *  5. getService() is now live: getCompanyInfo(), getUserInfo(),
 *     createTestCharge().
 */

export interface QuickBooksServiceDeps {
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  now?: () => number;
  hooks?: QuickBooksAuthHooks;
}

export class QuickBooksService {
  private constructor(
    orgId: string,
    private readonly config: QuickBooksConfig,
    private readonly client: QuickBooksClient,
  ) {
    void orgId; // reserved for per-org token persistence
  }

  static forOrg(orgId: string, deps: QuickBooksServiceDeps = {}): QuickBooksService | null {
    const config = loadQuickBooksConfig(deps.env);
    if (!config) return null;
    const auth = new QuickBooksAuth(config, deps.fetchFn, deps.now, deps.hooks);
    return new QuickBooksService(orgId, config, new QuickBooksClient(config, auth, deps.fetchFn));
  }

  /** Step 1: returns the Intuit consent URL + state (persist state, verify on return). */
  startAuthorization(): { url: string; state: string } {
    return buildAuthorizeUrl(this.config);
  }

  getCompanyInfo(): Promise<QuickBooksCompanyInfo> {
    return this.client.getCompanyInfo();
  }

  getUserInfo(): Promise<QuickBooksUserInfo> {
    return this.client.getUserInfo();
  }

  /** Sandbox only: creates a test card charge. Never call outside sandbox. */
  createTestCharge(request: QuickBooksChargeRequest): Promise<QuickBooksChargeResult> {
    return this.client.createTestCharge(request);
  }
}
