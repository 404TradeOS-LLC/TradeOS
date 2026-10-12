import { z } from "zod";
import { AbcSupplyAuth } from "./abcSupply";

/**
 * Thin client over the ABC Supply sandbox Account API (Search Accounts).
 *
 * ABC's documented discovery path for pricing: call Search Accounts with
 * `accountType = "Ship-To"` to list the Ship-To accounts available to the
 * integration and their branches, then have the user select a Ship-To +
 * branch before pricing — branches set their own catalogs and pricing.
 * There are no published fixed sandbox test values.
 *
 * ABC guidance: filter out Ship-To accounts with an empty `branches`
 * array — those are retired accounts from a former ERP system.
 */

// Sandbox Account API base. Hardcoded (never env/DB/request-derived) so
// this module cannot become an SSRF primitive. Mirrors abcSupply.ts.
const SANDBOX_API_BASE = "https://partners-sb.abcsupply.com";
const SEARCH_ACCOUNTS_PATH = "/api/account/v1/search/accounts";

export interface AbcBranch {
  number: string;
  name: string;
  status: string;
  homeBranch: boolean;
}

export interface AbcShipToAccount {
  number: string;
  name: string;
  status: string;
  branches: AbcBranch[];
}

const branchSchema = z
  .object({
    number: z.string(),
    name: z.string(),
    status: z.string(),
    homeBranch: z.boolean(),
  })
  .passthrough();

const shipToSchema = z
  .object({
    number: z.string(),
    name: z.string(),
    status: z.string(),
    branches: z.array(branchSchema),
  })
  .passthrough();

const searchAccountsResponseSchema = z
  .object({
    shipTos: z.array(shipToSchema).default([]),
  })
  .passthrough();

export class AbcSupplyAccountClient {
  constructor(
    private readonly auth: AbcSupplyAuth,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /**
   * Lists Ship-To accounts (with branches) visible to the integration.
   * Requires the `account.read` scope grant; a pricing-only token gets a
   * sanitized 403 here, which callers should translate into a
   * re-authorization prompt.
   */
  async searchShipToAccounts(signal?: AbortSignal): Promise<AbcShipToAccount[]> {
    const token = await this.auth.getAccountToken(signal);
    const response = await this.fetchFn(`${SANDBOX_API_BASE}${SEARCH_ACCOUNTS_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filters: [{ key: "accountType", condition: "equals", values: ["Ship-To"] }],
        pagination: { itemsPerPage: 50, pageNumber: 1 },
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`ABC Supply Search Accounts request failed: HTTP ${response.status}`);
    }
    const parsed = searchAccountsResponseSchema.parse(await response.json());
    return parsed.shipTos
      .filter((shipTo) => shipTo.branches.length > 0)
      .map((shipTo) => ({
        number: shipTo.number,
        name: shipTo.name,
        status: shipTo.status,
        branches: shipTo.branches.map((branch) => ({
          number: branch.number,
          name: branch.name,
          status: branch.status,
          homeBranch: branch.homeBranch,
        })),
      }));
  }
}
