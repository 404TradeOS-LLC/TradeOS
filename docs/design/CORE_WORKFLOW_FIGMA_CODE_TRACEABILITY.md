# Core Workflow Figma → Production Traceability

## Outcome

Map the authoritative TradeOS Figma master to current `main` without treating a Figma component or target screen as proof that runtime capability exists.

Authority: current implementation and governed module/current-state docs first; canonical Figma master `xImUa9CYUjx3Cb3zTrkfnY` for visual/interaction intent; this file is traceability only.

Figma engineering-spec board inspected: `[SPEC] Core Workflow Engineering Handoff` (`619:2149`).

## Shared component mapping

| Figma contract | Production seam | Classification | Rule |
| --- | --- | --- | --- |
| ControlDock | `web/src/components/shared/app-nav.tsx` | IMPLEMENTED / BEHAVIORAL MATCH | Keep Today · Dispatch · Create · Work · More and real attention counts only. |
| StickyTaskAction | Estimate mobile action pattern; `web/src/components/field/field-job-actions.tsx` | IMPLEMENTED AS PATTERN | Do not create another generic bottom-action system without proven reuse pressure. |
| EmptyState | `web/src/components/ui/empty-state.tsx` | IMPLEMENTED | Genuine loaded-data absence only. |
| loading/error/restricted taxonomy | `web/src/components/ui/feedback-state.tsx` plus route boundaries | IMPLEMENTED / ROLLING OUT | Keep empty, failure, permission, degraded and not-found distinct. |
| StatusBadge | `web/src/components/shared/status-badge.tsx` | IMPLEMENTED | Domain state first; color is not the only signal. |
| RecordRow | `web/src/components/shared/list-row-link.tsx` | IMPLEMENTED / CONVERGENCE TARGET | Converge instead of duplicating. |
| priced row | `web/src/components/shared/line-item-row.tsx` | IMPLEMENTED | Preserve owning-domain money semantics. |
| WorkspaceHeader | `web/src/components/shared/page-header.tsx` plus record-specific headers | PARTIAL / CONVERGENCE TARGET | Do not force a new heavy header abstraction. |
| PricingProvenance | `web/src/components/costbook/pricing-provenance.tsx` | IMPLEMENTED | Catalog facts and research evidence stay distinct. |
| Copperline document components | public/staff document pages | DESIGN COMPOSITION CONTRACT | No one-to-one React mapping proven; do not invent one solely for parity. |
| FieldRecord / FieldSyncState / PhotoEvidence | `/field`, FieldJobActions, FieldNoteForm where backed | TARGET / PARTIAL | Figma does not authorize offline/photo/change persistence. |
| FreshnessIndicator / SupplierPriceRow / JobActualComparison | Costbook provenance/research UI where backed | TARGET / PARTIAL | No universal freshness/trust enum exists in current contracts. |
| Signature motion components | existing CSS motion tokens + `framer-motion` | DESIGN CONTRACT | Bind only to real acknowledged state and reduced-motion behavior. |

## Estimate Workspace reconciliation

Inspected: `builder.tsx`, `estimate-mobile-contract.test.ts`, `ai-estimate-assist.tsx` and structured-estimator API/current-state contracts.

Confirmed:
- Scope → Items → Price → Review is production stage language.
- Leaving Scope waits for Project `simpleScope` persistence when changed; failure keeps the contractor on Scope.
- Estimator writes are review-first and server-token validated before Estimate Engine persistence.
- Mobile Items reuse authoritative edit/delete paths.
- Persisted estimate lines do **not** currently carry all pre-apply Athena provenance detail, so post-apply UI must not fabricate those trust badges.

## Customer Portal / Copperline reconciliation

Inspected public portal pages/tests, ADR-010 and portal/current-state docs.

Current truth:
- project/proposal/contract/invoice reads exist under the separate customer principal;
- public Proposal review is read-only;
- pending Contract signing is the current customer-originated mutation;
- public invoice payment is read-only;
- customer change approval, proposal accept/decline, selection approval, Pay Now, messaging and richer progress are not current public capabilities.

Copperline acceptance/change/pay/selection/work-authorization actions remain valid design targets, not implementation evidence.

## Field Workspace reconciliation

Inspected `web/src/app/(app)/field/page.tsx`, `field-job-actions.tsx` and `field-workspace-contract.test.ts`.

Current production supports assignment-scoped technician jobs, directions/briefing, notes/report-back, and bounded Start travel / Arrived / Pause / Resume / Complete lifecycle actions. Field completion remains separate from office invoice handoff.

Current contract tests intentionally reject advertising Take photo, Create issue, Record change, offline behavior and inventory. Richer Figma field capture/offline/change/material/customer/crew/Athena frames are target material until persistence and permission contracts exist.

## Costbook / Pricing Trust reconciliation

Inspected `pricing-provenance.tsx`, `research-review-model.ts` and governed Costbook docs.

Current rules:
- catalog mode shows stored supplier/update facts only and does not upgrade them into current/local/verified claims;
- research provenance vocabulary is `documented | unverified-legacy | placeholder`;
- research may show persisted source/date/region/confidence/review evidence and factual age text;
- no universal trust score or global stale threshold is canonical;
- unavailable evidence is not zero;
- Estimate pricing is a snapshot and must not silently drift.

Figma FreshnessIndicator and richer supplier/actual comparison components require backing domain/API contracts before production use.

## Stop conditions

Classify a design as TARGET/PARTIAL instead of implementing when it would broaden portal authority, advertise unsupported Field persistence, show Estimate provenance not persisted, invent Costbook trust/freshness certainty, or show customer/financial completion before server acknowledgement.


## Canonical engineering mapping boards

The canonical Figma Components page now carries explicit manual Figma → production maps because the current Figma seat cannot save native Code Connect records:

- Estimate Workspace: `634:2192`
- Copperline + Customer Portal: `635:2192`
- Field Workspace: `635:2238`
- Costbook + Assemblies: `635:2284`
- Estimate exception states: `635:2330`
- Mandatory engineering reuse rule: `635:2376`

These boards are handoff metadata, not runtime evidence. Their `EXACT`, `ALIGN`, `CONVERGE`, and `TARGET` classifications must be reconciled against current `main` whenever implementation ownership changes.

## Mandatory design → engineering extraction rule

Before creating or changing a frontend component for a mapped TradeOS surface:

1. Inspect current `main`, repository design/architecture contracts, relevant API/schema/security ownership, and active PR overlap.
2. Find the canonical Figma component or screen state on the Components page and read its mapping classification.
3. For `EXACT`, reuse the named production component rather than forking or restyling a duplicate.
4. For `ALIGN` or `CONVERGE`, modify or extend the smallest existing production owner before extracting a new shared abstraction.
5. For `TARGET`, do not make the Figma control interactive or claim it is shipped until backing persistence, permission, API, audit, and state contracts exist.
6. After implementation, verify the mapped behavior at the relevant breakpoints/states and preserve authentication, organization scope, RLS, auditability, and financial truth. Never claim browser/deployment verification without fresh evidence.

A new React component is justified only when no current production owner safely fits the responsibility or when repeated real production use proves that a shared abstraction is needed. Figma visual parity by itself is not sufficient justification.

## Verification still required

This is source inspection, not runtime certification. Remaining proof belongs to S053/S059/Field/Costbook evidence lanes and exact-head CI for any repair.
