import { Request, Response } from "express";
import { z } from "zod";
import { SupplierIntegrationService } from "../../modules/supplier-integration/service";
import { probeAbcSandboxPricing } from "../../modules/supplier-integration/abcPricingProbe";
import {
  ABC_OAUTH_BROWSER_COOKIE_NAME,
  ABC_OAUTH_CALLBACK_URL,
  ABC_OAUTH_SETTINGS_RETURN_URL,
  buildAuthorizeUrl,
  buildBrowserBindingCookie,
  buildClearBrowserBindingCookie,
  consumeAuthorizationState,
  createAuthorizationState,
  exchangeAuthorizationCode,
  isOAuthStateHmacConfigured,
  readCookieValue,
} from "../../modules/supplier-integration/abcOAuth";
import { abcSupplyRefreshTokenStore } from "../../modules/supplier-integration/credentialStore";
import { basePrisma, prisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { ApiError } from "../middleware/errorHandler";
import { logError, logInfo } from "../logging";
import { requireOrgId, requirePermissions } from "../requestContext";
import { catalogQuerySchema, parseCatalogQuery } from "../../modules/shared/catalog-query";

const service = new SupplierIntegrationService();
const idSchema = z.string().uuid();

const listQuerySchema = catalogQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  supplierId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
}).strict();

const enqueueSchema = z.object({
  supplierId: z.string().uuid(),
  materialId: z.string().uuid(),
  proposedUnitCost: z.coerce.number().finite().nonnegative().max(99_999_999.9999),
  source: z.string().trim().min(1).max(64).optional(),
}).strict();

const abcProbeSchema = z.object({
  productKey: z.literal("ABC-654210"),
}).strict();

const abcOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(512),
});

/**
 * Diagnostic step identifying where the ABC OAuth callback failed. Carries
 * no secrets, codes, or tokens — only the stage name, so a failed
 * reauthorization can be triaged from the redirect URL alone.
 */
export type AbcOAuthCallbackStep = "request" | "state" | "exchange" | "persist";

function abcOAuthReturnUrl(flag: "success" | "error", step?: AbcOAuthCallbackStep): string {
  const url = new URL(ABC_OAUTH_SETTINGS_RETURN_URL);
  url.searchParams.set("abc_oauth", flag);
  if (flag === "error" && step) url.searchParams.set("abc_oauth_step", step);
  return url.toString();
}

async function resolveAbcSupplier(orgId: string): Promise<string> {
  const supplierId = process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID?.trim();
  if (!supplierId) throw new ApiError(503, "ABC supplier routing is not configured");
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, orgId, apiIntegrationKey: "ABC_SUPPLY" },
    select: { id: true },
  });
  if (!supplier) throw new ApiError(404, "Configured ABC supplier is not available to this workspace");
  return supplier.id;
}

export const supplierIntegrationController = {
  /**
   * Starts the user-present ABC OAuth reauthorization flow. Returns the ABC
   * sandbox authorize URL; the founder's browser completes authorization at
   * ABC and returns via the allowlisted callback. Also sets the short-lived
   * httpOnly browser-binding cookie (RFC 6749 section 10.12) that the
   * callback requires before consuming the state.
   */
  async initiateAbcOAuth(req: Request, res: Response) {
    const actor = requirePermissions(req, ["costbook.manage"]);
    if (!["owner", "admin"].includes(actor.role)) {
      throw new ApiError(403, "Only a workspace owner/admin can connect ABC pricing");
    }
    const orgId = requireOrgId(req);
    const supplierId = await resolveAbcSupplier(orgId);
    const clientId = process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID?.trim();
    if (!clientId) throw new ApiError(503, "ABC sandbox credentials are not configured on the API");
    if (!isOAuthStateHmacConfigured()) {
      throw new ApiError(503, "ABC OAuth reauthorization is not configured on the API");
    }

    const { state, codeChallenge, browserBinding } = await createAuthorizationState({
      orgId,
      userId: actor.userId,
      supplierId,
    });
    res.setHeader("Set-Cookie", buildBrowserBindingCookie(browserBinding, req.hostname));
    res.json({
      authorizeUrl: buildAuthorizeUrl({
        clientId,
        redirectUri: ABC_OAUTH_CALLBACK_URL,
        state,
        codeChallenge,
      }),
    });
  },

  /**
   * ABC OAuth callback. Unauthenticated by design: the single-use state
   * token is the credential, and ABC's browser redirect carries no JWT.
   * The callback is bound to the initiating browser via the httpOnly
   * binding cookie: without a matching cookie the state is not consumed,
   * which defeats the token-substitution attack where an attacker tricks
   * someone else into completing their authorize URL. Consumes the state
   * exactly once, exchanges the code server-side, and persists the refresh
   * token through the owner/admin Vault path. Every outcome redirects to
   * Settings with a sanitized success/error flag; no codes, tokens, or
   * provider bodies are logged or surfaced.
   */
  async handleAbcOAuthCallback(req: Request, res: Response) {
    // The binding secret is single-use: expire the cookie on every callback
    // outcome so it never lingers in the browser past the flow.
    const finish = (flag: "success" | "error", step?: AbcOAuthCallbackStep) => {
      res.setHeader("Set-Cookie", buildClearBrowserBindingCookie(req.hostname));
      return res.redirect(302, abcOAuthReturnUrl(flag, step));
    };
    // Tracks the callback stage for the diagnostic step flag. A failed
    // state validation is otherwise silent server-side (consume returns
    // null rather than throwing), so the step is the only signal.
    let step: AbcOAuthCallbackStep = "request";
    try {
      const parsed = abcOAuthCallbackQuerySchema.parse(req.query);
      const browserBinding = readCookieValue(req.headers.cookie, ABC_OAUTH_BROWSER_COOKIE_NAME);
      step = "state";
      const consumed = await consumeAuthorizationState(parsed.state, browserBinding);
      if (!consumed || consumed.redirectUri !== ABC_OAUTH_CALLBACK_URL) {
        logError("supplier_integration.abc_oauth_callback_failed", {
          reason: "authorization_state_invalid",
          step,
        });
        return finish("error", step);
      }
      const clientId = process.env.ABC_SUPPLY_SANDBOX_CLIENT_ID?.trim();
      const clientSecret = process.env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        logError("supplier_integration.abc_oauth_callback_failed", { reason: "credentials_not_configured", step });
        return finish("error", step);
      }
      step = "exchange";
      const { refreshToken } = await exchangeAuthorizationCode({
        code: parsed.code,
        codeVerifier: consumed.codeVerifier,
        redirectUri: consumed.redirectUri,
        clientId,
        clientSecret,
      });
      step = "persist";
      await runWithBackgroundDatabaseSession(
        basePrisma,
        { jobName: "abc-oauth-callback", orgId: consumed.orgId, userId: consumed.userId },
        async () => {
          await abcSupplyRefreshTokenStore.persist(consumed.orgId, consumed.supplierId, refreshToken);
        },
      );
      logInfo("supplier_integration.abc_oauth_reauthorized", {
        orgId: consumed.orgId,
        supplierId: consumed.supplierId,
      });
      return finish("success");
    } catch (error) {
      logError("supplier_integration.abc_oauth_callback_failed", {
        error: error instanceof Error ? error.message : String(error),
        step,
      });
      return finish("error", step);
    }
  },

  async probeAbcSandbox(req: Request, res: Response) {
    const actor = requirePermissions(req, ["costbook.manage"]);
    if (!["owner", "admin"].includes(actor.role)) {
      throw new ApiError(403, "Only a workspace owner/admin can test ABC sandbox pricing");
    }
    const { productKey } = abcProbeSchema.parse(req.body);
    res.json(await probeAbcSandboxPricing(requireOrgId(req), productKey));
  },
  async listQueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.read"]);
    const parsed = listQuerySchema.parse(req.query);
    const query = parseCatalogQuery(
      { limit: parsed.limit, cursor: parsed.cursor, q: parsed.q, sort: parsed.sort, order: parsed.order ?? "desc" },
      { defaultSort: "createdAt", allowedSorts: ["createdAt", "status"], filters: { status: parsed.status, supplierId: parsed.supplierId, materialId: parsed.materialId } }
    );
    res.json(await service.listQueuePage(requireOrgId(req), query));
  },
  async enqueue(req: Request, res: Response) {
    requirePermissions(req, ["costbook.write"]);
    const orgId = requireOrgId(req);
    res.status(201).json(await service.enqueue({ ...enqueueSchema.parse(req.body), orgId }));
  },
  async approve(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.approve(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
  async reject(req: Request, res: Response) {
    const auth = requirePermissions(req, ["costbook.manage"]);
    res.json(await service.reject(idSchema.parse(req.params.id), requireOrgId(req), auth));
  },
};
