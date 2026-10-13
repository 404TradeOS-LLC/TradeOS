---
status: proposed
owner: costbook
last_verified: 2026-10-12
source_of_truth: false
related_code:
  - app/modules/supplier-integration/abcAccount.ts
  - app/modules/supplier-integration/abcSupply.ts
  - app/modules/supplier-integration/feed.ts
  - app/backend/controllers/supplierIntegration.controller.ts
  - web/src/components/settings/settings-console.tsx
---

# ABC Supply: Third-Party Aggregator production review and demo

**Integration type:** TradeOS is a multi-contractor commercial platform;
apply as a Third-Party Aggregator (not an Individual Business).
**Status:** Demo preparation only. As of 2026-10-12, ABC has not been
verified to have granted Production access, and no successful live
authorized sandbox account/price pair is on record. Do not claim otherwise.

## Founder / ABC-controlled approval

1. Log into the ABC Partner Developer Portal with the business's own
   credentials. Under **Manage Applications → Manage** select the existing
   sandbox integration. Verify its callback URL/scopes without publishing
   secrets. Verify the Third-Party Aggregator classification.
2. Upload an approved TradeOS logo in PNG/JPG/JPEG format, **under 1 MB**,
   and select **Production Request**. Do not publish user/customer account
   IDs, myABCSupply credentials, OAuth codes/tokens, or API secrets here.
3. Record only the request date/status and any redacted ABC case reference.
   ABC states an initial review may take 1–2 business days. ABC Support
   schedules a **live integration review demo**; approval is not automatic.
4. Do not switch sandbox hosts to production hosts, issue real customer
   requests, or enable background ABC customer-price sync before written
   Production approval and a separate reviewed configuration/deployment.

## Demo preflight: operator evidence (no synthetic pass claims)

- [ ] Both TradeOS frontend and backend production deployments are READY
      at the same exact main commit.
- [ ] An authenticated TradeOS owner/admin can open **Settings → Costbook**.
- [ ] **Connect / Reauthorize ABC** completes the sandbox OAuth PKCE
      callback with requested `pricing.read account.read offline_access`.
      Use an ABC sandbox identity provided/approved for demonstrations.
- [ ] **Find ABC accounts** returns actual authorized Ship-To accounts;
      note count and redacted branch metadata, **not** account numbers.
      A 409 means user-present reauthorization is still needed.
- [ ] Select an eligible active Ship-To and an active linked branch.
      Do not substitute IDs from the documentation's illustrative requests.
- [ ] Click **Test selected ABC price** for an allowlisted sandbox item
      (`02GASTZ3WW` or `654210`); this is a single real-time
      user-initiated read-only quote. Record redacted result, exact provider
      status and whether positive USD price + stocking UOM were returned.
      ABC sample SKUs are **not guaranteed priceable** for every account.
- [ ] Explicitly demonstrate zero side effects: no account preference
      stored, no Material, PriceObservation, SupplierPriceUpdate or invoice
      rewritten, no stocking-to-purchase UOM mapping certified.
- [ ] Check tenant isolation: a different organization and a non-owner
      account cannot access the same customer data or quote route.
- [ ] Confirm the scheduled supplier-price worker **does not call ABC**:
      customer pricing requires an active connected user. Other supplier
      sync feeds and the reviewer approval queue must remain independent.
- [ ] Reconcile any error status without displaying raw provider payload,
      tokens or actual account IDs; a zero-dollar line is not an eligible
      TradeOS costing quote.

## Demonstration order (illustrative, ~10–15 minutes, not an ABC-published duration)

1. Introduce TradeOS, a contractor-built estimating/workflow platform,
   and describe that ABC access belongs to each connected customer's
   account, not to TradeOS globally.
2. Show the owner/admin permission boundary and explicit ABC OAuth
   account connection. No credential or token is visible in the browser.
3. Show account discovery, Ship-To/branch selection, and the server-side
   verification of the selected pair before any pricing.
4. Submit **one** user-present sandbox estimate-purpose Price Items
   request; describe item eligibility, provider status, USD price and
   stocking unit. If the sandbox returns a per-line `Error`, show the
   safe diagnostic and say the item was **not** priced. Do not invent a price.
5. Show that the result does not update Materials or cross-compare ABC's
   customer-specific prices with competitor supplier feeds. Discuss
   why scheduled customer pricing is disabled and what the end user
   must do to request a quote.
6. Identify TradeOS's support ownership, pilot feedback handling,
   staged deployment/revert procedure and customer authorization
   controls. If ABC expects orders, get a separately governed ordering
   implementation; this pricing-only demo does **not** place orders.

## Production pilot gate checklist

- [ ] ABC has approved the production Third-Party Aggregator application
      and confirmed permissions, callback domains and user-presence rules.
- [ ] Scope production hosts and credentials separately from sandbox;
      protect Vault token rotation, tenant RLS and owner/admin controls.
- [ ] Have ABC confirm policy for costbook caching, export, provenance,
      refresh, and competitive price comparison *in writing*. Do not
      treat the general API permission as blanket approval.
- [ ] A consenting **real customer** user connects their ABC account
      through the production OAuth flow; no shared account bootstrap.
- [ ] A limited user-present read-only pilot proves an authorized active
      Ship-To/branch, valid line, price, USD currency, status and UOM.
- [ ] Obtain explicit cost/unit review before any proposed Material cost.
      No unattended ABC customer-price worker or automatic repricing.
- [ ] Complete agreed pilot support, hypercare, and general-availability
      checks before wider rollout.

## Safe evidence record

| Field | Allowed evidence |
| --- | --- |
| App/backend deployment | Exact git SHA + READY state |
| OAuth | Connection success/failure status; no tokens or codes |
| Account discovery | Eligible account count, branch count; redact IDs |
| Quote | SKU (approved test example), provider status, positive USD price yes/no, UOM yes/no |
| Write guard | Material/observation/update counts unchanged and explicit no-write flags |
| ABC approval | Request status, review/demo date, approved/denied, redacted case reference |
| Remaining blocker | Concise code or provider condition, no confidential response |

## Authoritative provider references

- [ABC Third-Party Aggregator Integration Track](https://apidocs.abcsupply.com/third-party-aggregator-integration-track/)
- [ABC Getting Started / API terms](https://apidocs.abcsupply.com/getting-started/)
- [ABC Production Request portal guide](https://apidocs.abcsupply.com/developer-portal-user-guide-2/)
- [ABC Search Accounts](https://apidocs.abcsupply.com/search-accounts/)
- [ABC Price Items](https://apidocs.abcsupply.com/price-items/)
- [ABC OAuth methods/scopes](https://apidocs.abcsupply.com/authorization-methods/)

This runbook does not establish a successful sandbox quote, production access,
or authorization to use ABC prices for competitive comparisons.
