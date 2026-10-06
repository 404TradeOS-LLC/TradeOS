import { z } from "zod";
import { QuickBooksAuth } from "./oauth";
import {
  QuickBooksChargeRequest,
  QuickBooksChargeResult,
  QuickBooksCompanyInfo,
  QuickBooksConfig,
  QuickBooksError,
  QuickBooksUserInfo,
} from "./types";

/**
 * Authenticated QuickBooks sandbox API client.
 *
 * Sandbox hosts (hardcoded — never from env, DB, or request input):
 * - Accounting: https://sandbox-quickbooks.api.intuit.com
 * - OpenID:     https://sandbox-accounts.platform.intuit.com
 * - Payments:   https://sandbox.api.intuit.com
 *
 * Every request carries a fresh Bearer token via QuickBooksAuth (auto
 * refresh). Intuit error payloads are mapped to QuickBooksError with the
 * Intuit error code preserved — never the token.
 */

export const SANDBOX_QBO_API_BASE = "https://sandbox-quickbooks.api.intuit.com";
export const SANDBOX_OPENID_BASE = "https://sandbox-accounts.platform.intuit.com";
export const SANDBOX_PAYMENTS_BASE = "https://sandbox.api.intuit.com";

const intuitFaultSchema = z.object({
  Fault: z.object({
    Error: z.array(z.object({ code: z.string(), message: z.string().optional() })).min(1),
  }),
});

const companyInfoSchema = z.object({
  CompanyInfo: z.object({
    CompanyName: z.string(),
    LegalName: z.string().optional(),
    CompanyAddr: z.record(z.string(), z.unknown()).optional(),
    Email: z.object({ Address: z.string().optional() }).optional(),
    WebAddr: z.object({ URI: z.string().optional() }).optional(),
  }),
});

const userInfoSchema = z
  .object({
    sub: z.string(),
    email: z.string().optional(),
    givenName: z.string().optional(),
    familyName: z.string().optional(),
    phoneNumber: z.string().optional(),
  })
  .passthrough();

const chargeResultSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    amount: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

async function throwForFault(response: Response, context: string): Promise<never> {
  let code = "api_request_failed";
  let intuitCode: string | undefined;
  try {
    const json = await response.json();
    const fault = intuitFaultSchema.safeParse(json);
    if (fault.success) {
      intuitCode = fault.data.Fault.Error[0]?.code;
      code = `intuit_${intuitCode ?? "fault"}`;
    }
  } catch {
    // fall through with the generic code
  }
  throw new QuickBooksError(
    `QuickBooks ${context} failed with HTTP ${response.status}`,
    code,
    response.status,
    intuitCode,
  );
}

export class QuickBooksClient {
  constructor(
    private readonly config: QuickBooksConfig,
    private readonly auth: QuickBooksAuth,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.auth.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    headers.set("accept", "application/json");
    return this.fetchFn(url, { ...init, headers });
  }

  /** GET /v3/company/{realmId}/companyinfo/{realmId} */
  async getCompanyInfo(): Promise<QuickBooksCompanyInfo> {
    const url =
      `${SANDBOX_QBO_API_BASE}/v3/company/${this.config.realmId}` +
      `/companyinfo/${this.config.realmId}?minorversion=75`;
    const response = await this.authedFetch(url);
    if (!response.ok) await throwForFault(response, "company info request");
    const parsed = companyInfoSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new QuickBooksError("Company info response failed validation", "bad_response");
    }
    const info = parsed.data.CompanyInfo;
    return {
      companyName: info.CompanyName,
      legalName: info.LegalName,
      companyAddr: info.CompanyAddr as Record<string, string> | undefined,
      email: info.Email?.Address,
      webAddr: info.WebAddr?.URI,
    };
  }

  /** GET /v1/openid_connect/userinfo */
  async getUserInfo(): Promise<QuickBooksUserInfo> {
    const response = await this.authedFetch(`${SANDBOX_OPENID_BASE}/v1/openid_connect/userinfo`);
    if (!response.ok) await throwForFault(response, "userinfo request");
    const parsed = userInfoSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new QuickBooksError("Userinfo response failed validation", "bad_response");
    }
    return {
      sub: parsed.data.sub,
      email: parsed.data.email,
      givenName: parsed.data.givenName,
      familyName: parsed.data.familyName,
      phoneNumber: parsed.data.phoneNumber,
    };
  }

  /** POST /quickbooks/v4/payments/charges — sandbox test charge. */
  async createTestCharge(request: QuickBooksChargeRequest): Promise<QuickBooksChargeResult> {
    const response = await this.authedFetch(`${SANDBOX_PAYMENTS_BASE}/quickbooks/v4/payments/charges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency ?? "USD",
        card: request.card,
      }),
    });
    if (!response.ok) await throwForFault(response, "test charge request");
    const parsed = chargeResultSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new QuickBooksError("Charge response failed validation", "bad_response");
    }
    return {
      id: parsed.data.id,
      status: parsed.data.status,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
    };
  }
}
