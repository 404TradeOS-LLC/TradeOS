import { AbcCatalogClient, type AbcCatalogPage, loadAbcSupplyAuthConfig } from "../modules/supplier-integration/abcCatalog";

export interface AbcCatalogProbeSummary {
  status: "verified_sandbox_page";
  provider: "ABC Supply";
  environment: "sandbox";
  productScope: "product.read";
  pagesVerified: number;
  providerReportedTotalItems: number;
  providerReportedTotalPages: number;
  activeProductsReturned: number;
  uniqueActiveProductIdentitiesChecked: number;
  storedProducts: 0;
  providerPricingRequested: false;
}

type CatalogPageReader = Pick<AbcCatalogClient, "list">;

/**
 * Live, deliberately non-persistent Product API proof.
 * No response bodies or item IDs are logged, saved, or uploaded.
 * Full-import and delta-sync code remain blocked on ABC data-use permission.
 */
export async function probeAbcSandboxCatalog(
  client: CatalogPageReader,
  options: { maxPages?: 1 | 2; itemsPerPage?: number } = {},
): Promise<AbcCatalogProbeSummary> {
  const maxPages = options.maxPages ?? 1;
  const itemsPerPage = options.itemsPerPage ?? 25;
  if (![1, 2].includes(maxPages) || !Number.isInteger(itemsPerPage) ||
    itemsPerPage < 1 || itemsPerPage > 50) {
    throw new Error("invalid_probe_bounds");
  }

  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  let pagesVerified = 0;
  let activeProductsReturned = 0;
  const seen = new Set<string>();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    if (providerTotalPages !== null && pageNumber > providerTotalPages) break;

    const page: AbcCatalogPage = await client.list({ pageNumber, itemsPerPage });
    const pagination = page.pagination;

    if (page.environment !== "sandbox" || page.source !== "ABC Supply" ||
      page.persisted !== false || page.pricing !== "not-requested" ||
      pagination.pageNumber !== pageNumber || pagination.itemsPerPage !== itemsPerPage) {
      throw new Error("catalog_probe_contract_mismatch");
    }

    if (pageNumber === 1) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
      if (providerTotalItems < 1 || providerTotalPages < 1 || page.items.length < 1) {
        throw new Error("catalog_probe_empty_first_page");
      }
    } else if (providerTotalItems !== pagination.totalItems ||
               providerTotalPages !== pagination.totalPages) {
      throw new Error("catalog_probe_pagination_drift");
    }

    for (const item of page.items) {
      if (item.priceStatus !== "unpriced" || !item.itemNumber ||
          seen.has(item.itemNumber)) {
        throw new Error("catalog_probe_identity_or_pricing_mismatch");
      }
      seen.add(item.itemNumber);
    }
    activeProductsReturned += page.items.length;
    pagesVerified++;
  }

  if (providerTotalItems === null || providerTotalPages === null) {
    throw new Error("catalog_probe_missing_pagination");
  }

  return {
    status: "verified_sandbox_page",
    provider: "ABC Supply",
    environment: "sandbox",
    productScope: "product.read",
    pagesVerified,
    providerReportedTotalItems: providerTotalItems,
    providerReportedTotalPages: providerTotalPages,
    activeProductsReturned,
    uniqueActiveProductIdentitiesChecked: seen.size,
    storedProducts: 0,
    providerPricingRequested: false,
  };
}

async function main(): Promise<void> {
  // No arbitrary URLs, SKUs, accounts, branch numbers, tokens, or response bodies
  // are accepted as input. The operator can only opt into a second bounded page.
  const arg = process.argv[2];
  if (process.argv.length > 3 || (arg !== undefined && arg !== "--two-pages")) {
    throw new Error("invalid_probe_arguments");
  }
  const config = loadAbcSupplyAuthConfig();
  if (!config) throw new Error("missing_sandbox_client_credentials");
  const client = new AbcCatalogClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  const result = await probeAbcSandboxCatalog(client, {
    maxPages: arg === "--two-pages" ? 2 : 1,
    itemsPerPage: 25,
  });
  // Metadata only. No item names, SKUs, bearer tokens, or raw response.
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    // Never print provider response bodies, token, credential, or raw exception.
    const allowedCodes = new Set([
      "invalid_probe_arguments",
      "missing_sandbox_client_credentials",
      "catalog_probe_contract_mismatch",
      "catalog_probe_empty_first_page",
      "catalog_probe_pagination_drift",
      "catalog_probe_identity_or_pricing_mismatch",
      "catalog_probe_missing_pagination",
    ]);
    const message = error instanceof Error ? error.message : "";
    const code = allowedCodes.has(message) ? message
      : /^ABC catalog provider denied request: HTTP \d{3}$/.test(message)
        ? "provider_denied"
        : "provider_or_schema_failure";
    process.stderr.write("ABC sandbox Product API validation failed: " + code + "\n");
    process.exitCode = 1;
  });
}
