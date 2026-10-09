---
status: proposed
owner: costbook
last_verified: 2026-10-09
source_of_truth: false
related_code:
  - app/scripts/activate-abc-supply-material.ts
  - app/modules/supplier-integration/abcMaterialActivation.ts
  - app/modules/supplier-integration/abcSupply.ts
  - app/modules/supplier-integration/feed.ts
  - app/modules/supplier-integration/service.ts
  - .github/workflows/seed-costbook-supplier-prices-47802.yml
---

# ABC Supply live-pricing activation: governed pilot

## Observed production state (2026-10-09; read-only verification)

After the governed 47802 supplier-evidence import, a direct production read
reports **3,188 SupplierProduct rows** and **3,188 immutable
SupplierPriceObservation rows** across six suppliers, all observations assigned
to one organization, with no unscoped rows. ABC Supply has **584 supplier
products** including **186 SKU-bearing rows**. The observation timestamps
represent historical supplier evidence, **not** live sandbox pricing.

**Zero Material rows** and **zero SupplierPriceUpdate rows** remain. At
15:45:56 UTC, the deployed production cron completed with HTTP 200,
one scheduled job, `proposed: 0`, `skipped: 0`. This proves infrastructure
dispatch but not a live ABC quote, OAuth rotation, or price-review write.

Both the TradeOS web and backend Vercel production deployments of merged
PR #704, SHA `9492b484ace43db84e7697e6d96b6ff9dce80ff0`, are READY
and aliased to `app.404tradeos.com` and `api.404tradeos.com`.

A manually verified candidate for preview is product
`ABC-654210`, supplier SKU `654210`, recorded source purchase unit
`SQ`, and canonical key `ROOFING-UNDERLAYMENT-SYNTHETIC-STANDARD`.
It has exactly one source observation and a unique SKU within the current
ABC supplier product dataset. Neither stock-unit compatibility nor ABC
sandbox pricing eligibility is certified by that static evidence.

## Finding the required workflow IDs

In the authenticated TradeOS web app, an active owner/admin can open **Settings → Costbook → Supplier workflow IDs** to copy the actual organization UUID and application user UUID into the two GitHub Actions workflow inputs. The backend returns the authenticated AppUser ID; the app shows it only when exactly one active owner/admin membership for that exact user ID is present in the tenant-scoped Settings response. Stored email addresses are not identity selectors. If it cannot resolve this safely, the copy card is absent and no identity is inferred.

The workflow's **user** UUID is **not** the membership row UUID, Supabase Auth subject or Supabase project reference. Do not infer missing tenant membership from database table estimates: RLS or stale planner statistics can produce apparent zero-row counts. The existing workflow continues to validate operator inputs and active tenant permissions; copying IDs neither seeds data nor grants permissions.

## Separation of responsibilities

1. Finish the existing idempotent six-supplier evidence workflow; do not run
   an unreviewed SQL copy or create fictitious supplier prices. The workflow is
   [Seed 47802 Costbook supplier evidence](../../.github/workflows/seed-costbook-supplier-prices-47802.yml).
   It requires a restricted app database role, an exact tenant UUID and active
   owner/admin UUID, and `IMPORT_47802_SUPPLIER_EVIDENCE` confirmation.
   Its retained result must verify 3,188 products and 3,188 observations.
2. Review one actual ABC supplier product with a unique, verified SKU,
   a governed canonical mapping, an explicit purchase unit and source
   observation. The ABC sandbox branch/ship-to pair must be supported for the
   selected SKU; September retail evidence is NOT an ABC sandbox entitlement.
3. Preview the single-product Material activation using the tenant-scoped
   operator. It requires the active owner/admin identity and makes **no writes**
   without `--apply`. The operator refuses an absent/duplicate SKU, incomplete
   identity, already-linked Material, and mismatched cost/unit acknowledgement.
4. To activate, the owner/admin must separately approve an initial unit cost
   (not silently copy the static observation price), confirm the exact SKU and
   unit, and explicitly opt into one transaction. The new Material is
   linked to its supplier product and an activity audit is recorded.
5. The existing supplier cron may then request a sandbox quote. Quotes from
   the ABC feed enter **SupplierPriceUpdate(status=pending)** when eligible and
   changed; they never directly modify Material prices. A named reviewer must
   approve or reject each pending update. Approval writes the MaterialPriceAudit
   and preserves existing Estimate snapshots.

### Read-only preview from GitHub Actions (no CLI required)

The manual [Preview one ABC Supply Material](../../.github/workflows/preview-abc-supply-material.yml)
workflow can be run on `main` with `org_id`, `user_id` and the
**exact** `product_key` (e.g. `ABC-654210`). It uses the production
GitHub Environment, an RLS-restricted database role, input validation,
and the unchanged operator's read-only path. It rejects an unauthorized,
ambiguous or unobserved candidate. No `--apply` or cost input exists in
this workflow, so no Material is created. Its passing preview is **not**
permission to activate or evidence of a real ABC quote.

### Operator commands (run in `app/` with restricted `DATABASE_URL`)

Preview — requires tenant and actor scope:

```bash
npm run costbook:activate-abc-material -- \
  --org-id="<ORG_UUID>" --user-id="<OWNER_OR_ADMIN_UUID>" \
  --product-key="<EXACT_ABC_SUPPLIER_PRODUCT_KEY>"
```

Apply exactly one manually approved baseline:

```bash
npm run costbook:activate-abc-material -- \
  --org-id="<ORG_UUID>" --user-id="<OWNER_OR_ADMIN_UUID>" \
  --product-key="<EXACT_ABC_SUPPLIER_PRODUCT_KEY>" \
  --approved-unit-cost="<MANUALLY_APPROVED_PRICE>" \
  --confirm-sku="<EXACT_SOURCE_SKU>" --confirm-unit="<EXACT_SOURCE_PURCHASE_UNIT>" \
  --confirmation=ACTIVATE_ONE_ABC_MATERIAL --apply
```

Do not assume the ABC sandbox's stocking unit matches static retail
`purchaseUnit`; check that mapping before using the proposed price. Do not
promote any of the 3,188 static observations as live prices, and never autoapprove ABC quotes.

## Verification gates before declaring live-price success

- A current authenticated ABC sandbox API request is observed with an actual
  accepted SKU and a successful priced line; the request must use the
  approved sandbox branch and ship-to.
- Durable refresh-token rotation remains successful through the private Vault
  helper (rotation must commit even if a later quote fails).
- The resulting tenant-scoped SupplierPriceUpdate row is `pending`, has
  `source = supplier-feed`, and references the intended Material/supplier.
- A read-only query confirms Material unit cost did not change after sync.
- A separately authorized reviewer approves only after confirming identity,
  currency, stocking unit, and price. The audit trail and Estimate snapshot
  retention are checked. Until then, keep the row pending.

## Still blocked / not claimed

- 3,188/3,188 historical supplier evidence records are present, but the
  protected import workflow's execution evidence is not attached to this document.
- Zero Materials as of this snapshot: no automatic quote eligibility.
- Vercel environment variable listing was forbidden to the connected actor
  (HTTP 403); no values were read, changed, or exposed.
- No authenticated ABC token refresh or pricing call occurred in this work.
  Production access has not been granted; sandbox results are not production
  or Terre Haute customer-specific prices.
- No production seed, Material activation, manual price approval, or deployment
  is authorized solely by this documentation.
