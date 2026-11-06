# Invited beta: estimate through proposal PDF

Founder-approved scope, 2026-11-06: free beta for 1–3 businesses doing real customer work. Launch follows readiness gates, not a date. Founder owns cohort selection, onboarding, support, incident disposition, and GO/HOLD; engineering owns repairs and evidence. This record narrows the cohort workflow, not the repository's security standards or numbered sprint completion criteria.

## Required journey

Customer → Project → manual or reviewed AI-assisted Estimate → saved/reloaded and finalized Estimate → Proposal → contractor-branded PDF downloaded by the contractor for delivery outside TradeOS.

Jobs, dispatch, field work, invoicing, subscriptions, customer portal acceptance, and new integrations are deferred. This is a support/acceptance boundary, not a feature flag: those existing surfaces are not disabled by this change. Shared security, storage, schema and deployment defects still block this beta. No billing bypass or entitlement change is authorized here.

## Release record — HOLD

Source baseline: `376a089b57a21e9c39d3eb0172411f95b9ff7380` on `main`. Estimate Apply verification #929 and authenticated reload harness #930 are landed; this is source evidence only. The live open-PR reconciliation on 2026-11-06 found #931/#923/#924 email work, #921 readiness-console role evidence, #904 staging Job web promotion, #775 preview configuration, and unrelated Forge/motion work. Continue their existing lanes rather than opening competing implementations. Do not require unrelated deferred features merely because they have an open PR.

| Gate | Owner | State and required closure |
| --- | --- | --- |
| Customer/Project role and persistence | Engineering | UNVERIFIED: retained current-source S052 full evidence, including admin and inactive-membership denial |
| AI review/Apply and manual estimate | Engineering | UNVERIFIED: `beta_pdf` full four-width evidence; reviewed saved identities, quantities and targets survive reload |
| Clarification answer/regeneration | Engineering + founder | OPEN: persisted one-question footing answer/regenerate contract is still TARGET work; no simulated completion or incidental Project-scope overwrite |
| Financial discrepancies | Engineering | OPEN: reproduce documented $1,670 deck and Estimate $2.10 → Proposal $42,680 examples, reconcile against authoritative pricing/snapshots, retain regression fixtures; do not copy design values into calculations |
| Proposal snapshot and PDF | Engineering | UNVERIFIED: exact Estimate reference/price after reload, authenticated PDF success and foreign PDF denial, plus visual total/branding/logo fallback inspection |
| Environment and database | Release operator | UNVERIFIED: matching web/API SHAs, effective nonproduction bindings, ledger/checksum parity and live forced-RLS same/cross-tenant tests; never replay the applied Job handoff migration |
| Identity and storage | Engineering + release operator | UNVERIFIED: invitations, login/session expiry, recovery, delivery failure handling, private file access and export/offboarding |
| Recovery and operations | Release operator + founder | UNVERIFIED: actual disposable database/storage restore rehearsal with measured recovery time/data-loss window, approved rollback target, alerts and support contact |
| Cohort | Founder | OPEN: name first business and support contact privately; confirm consent, limitations and data policy |

A PDF scenario PASS certifies only that scenario. It does not close clarification, disputed historical pricing, S052 roles, operational recovery, or full S100 release certification. No protected workflow, production release or invitation has been executed by this source change.

## Evidence procedure

1. Review and merge the relevant source under normal repository controls. Release operator selects an approved isolated nonproduction target with dedicated synthetic owner/admin/inactive accounts and known foreign Customer, Project, Estimate and Proposal fixtures.
2. Prove effective bindings and migration parity using existing protected staging controls. Capture matching API/web source identity. Missing access or mismatch means HOLD, not a reason to use production fixtures.
3. Run the existing Beta Evidence workflow in `preflight` mode with `scenario=beta_pdf`, an explicit expected SHA and approved target. Provide the existing smoke/foreign fixtures plus `BETA_RC_FOREIGN_PROPOSAL_ID` and dedicated synthetic `BETA_RC_FOREIGN_OWNER_EMAIL`, `BETA_RC_FOREIGN_OWNER_PASSWORD`, `BETA_RC_FOREIGN_OWNER_ORG_ID`. The foreign owner/admin must belong to that pinned organization, distinct from the smoke tenant, and must be able to read the Proposal. Its session remains in memory. Preflight is configuration only.
4. Run `mode=full`, `scenario=beta_pdf` at all four widths through the same workflow after its protected prerequisites pass. The scenario reuses S053 AI generation/review/Apply/reload checks, cleans only its synthetic AI lines, then exercises the canonical manual financial fixture through Proposal. It downloads the PDF and stops before Send/Accept/Contract/Invoice.
5. Review current-run metadata, capture assertions, network/console results, tenant-denial results, `proposal.pdf` and `proposal-pdf.json` at each width. PDF receipts bind bytes/hash/Proposal ID/run ID; transport validation is not PDF content validation. Visually verify contractor name/logo or safe fallback, project/customer, total, line wrapping and page breaks against saved Proposal/Estimate. Use synthetic data only in retained artifacts.
6. Run S052 role evidence separately on the same candidate; retain accessibility/keyboard checks and reviewed financial regression results. Require passing PDF renderer tests for the exact release SHA (including `app/tests/proposal-pdf-branding.test.ts`) and retain the CI run/results before the release decision. Execute and retain identity/recovery/storage/restore checks above. Record workflow URLs, deployment IDs/SHAs, owners and residual risks in the release decision.
7. Founder records GO, CONDITIONAL GO or HOLD for the exact release. No security, isolation, financial correctness, data-loss or deployment blocker can be accepted as a noncritical limitation. No sprint status changes solely from this document.

Local equivalent (with approved synthetic environment variables already configured): `npm run beta:evidence -- --scenario=beta_pdf --allow-mutations`. A single `--viewport=390` run is debugging only and emits PARTIAL. Never paste credentials into commands, docs or evidence. Full runs create synthetic records; use the existing approved fixture lifecycle, never bulk-delete tenant data.

## Onboarding and support

Before the first invitation, founder records privately the business owner, consent, support address/phone, onboarding date and agreed recovery expectations. Explain free beta scope and that contractors must review AI scope, mapping, quantities, provenance and final prices before applying or sending a PDF. No automatic supplier-price or AI approval is promised.

Onboard the first business with a guided Customer → Project → Estimate → Proposal/PDF exercise. Explain saving/reloading, explicit retry after uncertain Apply, manual estimating, and PDF delivery. Avoid untested legacy-data imports. Confirm access only to that organization's records and how to report a problem without sharing passwords, tokens or unnecessary customer data.

Triage routine feedback every business day in the existing governed issue queue: workflow location, expected/actual result, severity, owner, redacted reproduction and resolution. Critical means suspected cross-tenant access, wrong financial output, lost/corrupted data or inability to operate safely: stop new invitations immediately, contact founder, preserve redacted diagnostics, and use the reviewed rollback/recovery procedure. Never automatically retry a money/data operation or roll application code back across incompatible schema.

Expand from one business to at most three after seven consecutive days without a critical incident and a founder feedback review. A critical incident restarts that window after verified resolution. Before offboarding, provide the founder-approved authorized export, confirm account suspension/session revocation behavior, and follow the agreed retention/deletion policy; do not improvise destructive database commands.
