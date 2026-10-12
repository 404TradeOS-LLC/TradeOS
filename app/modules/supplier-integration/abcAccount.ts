import { z } from "zod";
import { AbcSupplyAuth } from "./abcSupply";

/**
 * Thin client over the ABC Supply sandbox Account API (Search Accounts).
 *
 * ABC's documented discovery path for pricing: call Search Accounts with
 * `accountType = "Ship-to"` to list the Ship-To accounts available to the
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
const PAGE_SIZE = 50;
// Bounded calls and memory. Fail closed instead of silently hiding additional
// Ship-Tos if a provider response advertises more pages than we can traverse.
const MAX_SEARCH_ACCOUNT_PAGES = 100;

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
    pagination: z
      .object({
        pageNumber: z.number().int().positive(),
        totalPages: z.number().int().positive(),
      })
      .passthrough(),
    shipTos: z.array(shipToSchema).max(PAGE_SIZE),
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
   *
   * Traverses every result page up to the explicit safety bound; a malformed,
   * inconsistent, or larger result fails rather than silently returning
   * an incomplete set of customer accounts.
   */
  async searchShipToAccounts(signal?: AbortSignal): Promise<AbcShipToAccount[]> {
    const token = await this.auth.getAccountToken(signal);
    const allShipTos: z.infer<typeof shipToSchema>[] = [];
    let expectedTotalPages: number | null = null;
    for (let pageNumber = 1; ; pageNumber += 1) {
      if (signal?.aborted) {
        throw new Error("ABC Supply Search Accounts request was canceled");
      }
      const response = await this.fetchFn(`${SANDBOX_API_BASE}${SEARCH_ACCOUNTS_PATH}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Exact value from the official Search Accounts example request.
          filters: [{ key: "accountType", condition: "equals", values: ["Ship-to"] }],
          pagination: { itemsPerPage: PAGE_SIZE, pageNumber },
        }),
        signal,
      });
      if (!response.ok) {
        throw new Error(`ABC Supply Search Accounts request failed: HTTP ${response.status}`);
      }
      // A malformed provider response must not masquerade as "no accounts"
      // or produce an incomplete list. Never return provider payload details.
      const parsed = searchAccountsResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.pagination.pageNumber !== pageNumber) {
        throw new Error("ABC Supply Search Accounts response is invalid");
      }
      const { totalPages } = parsed.data.pagination;
      if (totalPages > MAX_SEARCH_ACCOUNT_PAGES) {
        throw new Error("ABC Supply Search Accounts result exceeds the safe page limit");
      }
      if (expectedTotalPages !== null && totalPages !== expectedTotalPages) {
        throw new Error("ABC Supply Search Accounts pagination changed during discovery");
      }
      expectedTotalPages = totalPages;
      allShipTos.push(...parsed.data.shipTos);
      if (pageNumber === totalPages) break;
    }
    return allShipTos
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
