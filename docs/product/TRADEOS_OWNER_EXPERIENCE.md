---
status: current
owner: product
last_verified: 2026-07-15
source_of_truth: true
related_code:
  - docs/research/CONTRACTOR_UX_RESEARCH.md
  - docs/product/TRADEOS_UX_ADVANTAGES.md
  - docs/product/FOUNDER_PREVIEW_EXPERIENCE_SPEC.md
  - docs/PRODUCT_SCOPE.md
  - docs/CURRENT_STATE.md
---

# TradeOS Owner Experience

This document defines the intended owner/admin daily experience of TradeOS. It is a
product-direction document, not an implementation ticket list — implementation
boundaries for the current build are in
`docs/product/FOUNDER_PREVIEW_EXPERIENCE_SPEC.md`. Evidence backing these decisions is
in `docs/research/CONTRACTOR_UX_RESEARCH.md`.

## Product thesis

**TradeOS prepares. The contractor decides.**

TradeOS should know what is happening before the owner opens it, quietly organize the
administrative work, and surface only the decisions that require human judgment. The
experience should feel like *their* business — populated, calm, immediately useful,
powerful without looking complicated, and credible enough to run a real company on. This
principle governs every screen described below: information that doesn't require a
decision gets automated, summarized, or hidden; information that does require a decision
gets surfaced plainly, with the system's reasoning attached.

## First-time login

1. **Handoff or cold start.** If the contractor arrived via a 404 TradeOS marketing-site
   handoff, TradeOS opens on a confirmation card of already-known business info rather
   than a blank signup form. If arriving cold, the single highest-leverage first question
   is the business website URL (with a visible skip path — never a hard dependency).
2. **Brand confirmation** (below).
3. **One branching question**: moving from another system, moving from spreadsheets, or
   starting fresh — this single fork replaces a generic multi-step wizard.
4. **Import or quick-start**, matched to that branch (see Migration and import).
5. **Team setup**, deferrable.
6. **QuickBooks connect** — product direction only; **not implemented today** (see
   Migration and import, below). Offered after real data exists and never forced before
   it once built; out of scope for the Founder Preview until that integration exists.
7. **First-success landing** on a populated workspace with one concrete next action.

## Brand confirmation

From a business website URL, auto-detect business name, logo, primary brand color, and
contact information, and present all of it as an editable confirmation card — every
field pre-filled, none silently locked in. This is the single highest-leverage,
lowest-effort expression of "TradeOS prepares": the owner's first impression of the
product should already look like their own company, not a generic template waiting to
be branded.

## Migration and import

- **Spreadsheets/CSV** is the fully self-serve, most-polished import path: template
  download, automatic column-to-field mapping with manual correction, a duplicate and
  validation review screen showing exact counts ("142 ready, 6 need review, 3 possible
  duplicates"), and an explicit "Import N records" confirmation — nothing writes before
  that click.
- **Prior field-service platforms** (ServiceTitan, Jobber, Housecall Pro, Workiz, Service
  Fusion): realistic MVP path is accepting each platform's native CSV/Excel export
  through the same generic importer, with source-specific column-mapping presets as a
  convenience layer. Live, automated, bidirectional API sync with these platforms is
  explicitly **not** realistic at MVP — see Production MVP boundaries.
- **Buildertrend** specifically has no self-serve bulk export today; the only realistic
  path is manual/concierge-assisted data entry, or starting fresh with prior records
  attached as read-only reference documents.
- **QuickBooks Online** is a genuine, buildable native integration (mature, documented
  OAuth flow) — positioned as an ongoing connection for invoices/payments, not a one-time
  migration, and typically kept running in parallel with accounting rather than replaced.
  **Implementation status**: this is product direction, not a built capability — no
  QuickBooks/OAuth integration exists in the codebase today. It must be implemented, and
  separately approved, before it can be part of the Founder Preview or any release.
- **No prior system**: minimal guided quick-add of the first few customers, framed the
  same way as an import, so the workspace is populated within minutes regardless of
  starting point.
- **Trust and safety, non-negotiable for every path**: no write happens before an
  explicit confirmation step; no silent overwrite or auto-merge of matched records
  (always a visible skip/merge/create-new choice); every import is reversible for a
  bounded window; every import is attributed in an audit trail (who, source, when, row
  count) — matching the audit discipline TradeOS already applies to membership and
  price-history changes; partial failures are quarantined and reported per-row rather
  than aborting the whole batch; data portability is stated up front as a promise, not
  left implicit.

## Team setup

A single screen: invite by email into one of the roles the invite flow currently
supports, with the signing owner shown as already part of the team.

**Current implementation**: invites are limited to the dispatcher and technician roles
(`app/modules/auth/service.ts`, `app/backend/controllers/auth.controller.ts`) — an
owner/admin account is created through organization signup, not through this invite
flow. Email is the only supported invite channel today; there is no phone-based invite.

Entirely skippable — a solo contractor should not be blocked from entering the workspace
by an empty team screen.

**Future work, not currently implemented**: inviting additional owner/admin members and
a phone-based invite channel are reasonable product directions but are not built today
and are out of scope for the Founder Preview unless separately approved.

## First-success workflow

The first thing an owner should be able to do — inside minutes, not after finishing a
wizard — is act on their own real data: create an estimate for an actual imported (or
quick-added) customer, or see their real ready-to-invoice work. The workspace should
never present a demo state; the "win" is recognizing their own business inside the
product.

## Daily command center

Every element answers one of two questions: *is today under control?* or *what needs my
judgment today?* Anything informational-but-not-actionable, or actionable-but-below the
owner's judgment level, is automated away or pushed to a drill-in screen — never shown
on the first screen.

### First 30 seconds

A single status band, not a dashboard:

- **Day-status indicator**: "On track" / "Needs attention (N)" / "At risk (N)"
- **Crew coverage**: e.g. "11 of 13 techs dispatched, 2 callouts"
- **Unassigned jobs**: count only
- **Cash snapshot**: one number — total overdue dollars, not a chart
- **Escalation flag**: present only if one exists; silence is itself the signal

On a clean day this tier should look almost empty. A calm, quiet, populated state *is*
the message that the business is running — this is the emotional core of "TradeOS
prepares."

### First 3 minutes

One ranked decision queue, ordered by consequence-if-ignored, each row pre-packaged with
a suggested resolution and a same-row action (expand-in-place, never navigate away):

1. Callouts/no-shows, with a suggested reassignment
2. Unassigned jobs, with a suggested technician/slot
3. Job risk flags (running over, stuck on-site, safety/permit flag)
4. Weather-risk jobs — **only** jobs tagged exterior work (roofing, paving, exterior
   HVAC) with adverse forecast in their scheduled window; never a standing weather widget
5. Customer escalations — always owner-routed, never auto-resolved
6. Parts/material blockers that threaten today's or tomorrow's work
7. Ready-to-invoice work — count and total dollars; standard invoices auto-generate and
   send, owner sees only exceptions (custom terms, disputed scope)
8. Overdue invoices — top few by amount/age plus an aggregate total; standard reminder
   cadence runs automatically, owner sees only significantly overdue or high-value cases
9. Estimates awaiting follow-up — aged count; automated check-in nudges run first, owner
   escalation only past a configurable staleness threshold
10. Unsigned proposals — same treatment as estimates
11. Punch-list deadlines due today/tomorrow

### First 15 minutes (drill-in, only if something looked off)

Full dispatch board, full AR aging with per-customer history, estimate/proposal pipeline
by stage, full job detail and timeline, technician detail and workload, supplier/material
queue detail, and historical performance trends. Trend charts and leaderboards belong
here, never in the first two tiers.

## Voice interaction

Scoped to short, hands-busy, truck-dashboard-appropriate commands with spoken
confirmation before any consequential action — never multi-turn reasoning or reading
long lists aloud:

- "What's today look like?" — spoken Tier 1 summary
- "Any callouts today?" — reads callouts and suggested reassignment
- "Reassign the Miller job to Dave." — confirms before executing
- "Read me the overdue invoices." — top few by amount
- "Call the Smith job customer." / "Text the crew we're running late." — hands off to
  phone/SMS rather than composing nuanced messages
- "What's blocking the Nguyen job?"
- "Mark the Rivera job complete." — status update only, no financial judgment
- "Any weather issues today?"

Explicitly excluded from voice: approving money above a threshold, multi-step
reasoning, and reading estimate/proposal lists in full — those stay visual.

## Approvals

Owner-level approval is reserved for actions with real consequence: change orders,
supplier price updates above a threshold, invoices/write-offs outside standard terms,
and anything the automated cadence (reminders, nudges, auto-reorders) could not resolve
on its own. Routine, in-policy actions (standard invoice send, standard reminder
cadence, low-value auto-reorder) proceed without owner review, consistent with "the
contractor decides" applying to judgment calls, not every transaction.

## Mobile owner experience

Mobile is a subtraction from desktop, not a shrink:

| | Desktop | Mobile |
|---|---|---|
| Default view | Tier 1 + full Tier 2 queue, drill-in inline | Tier 1 status chip, then Tier 2 as one scrollable feed |
| Dispatch | Full drag-and-drop grid | List view; reassignment via tap-to-picker |
| Financial data | Aging buckets, trend charts in drill-in | Aggregate dollar figures only, no charts |
| Notifications | Passive badge counts | Push only for callouts/escalations; routine items stay pull |
| Input | Keyboard, mouse, bulk actions | Voice entry point, large single-tap actions, inline call/text |
| Admin surfaces | Settings, membership, price history reachable from command center | Not present in the daily command center; live in a separate office area |

## Empty, loading, and error states

- **Empty is never the default first state.** A brand-new org lands on a populated
  workspace via import or quick-add, never a blank dashboard.
  See Founder Preview requirements for the concrete no-blank-screen rule.
- **Loading** is a short, branded transition, not a generic spinner on an unstyled
  screen — the workspace should already feel like the contractor's business while it
  loads, not after.
  **Failure of a background automation must fail loud and specific** (e.g. "3 of 142
  rows could not be imported: missing phone number") — never a silent partial success
  presented as complete.
- **Errors never block entry to the workspace.** A failed brand-detect or a stalled
  import degrades gracefully to manual entry or a retry, never a dead end; the same
  principle applies to QuickBooks connect once that integration is built.

## What must never happen

- A blank primary screen, an empty dashboard, or lorem-ipsum placeholder content on any
  screen a real user reaches.
- Fabricated analytics (a number with no real underlying data) presented as if real.
- Any data import writing before an explicit, row-visible confirmation step.
- Silent overwrite or auto-merge of a matched customer/job/equipment record.
- An unrecoverable import — every import must be reversible within a bounded window.
- A voice command executing a financially or operationally consequential action without
  a spoken confirmation step.
- Marketing language appearing inside the authenticated product surface.
- Modal-on-modal stacking.
- More than one primary action competing for attention on a single screen.

## Production MVP boundaries

Explicitly realistic to build now:

- Website-based brand auto-detection (name, logo, color, contact) with an editable
  confirmation step.
- A generic CSV/Excel import wizard (customers, jobs, estimates, invoices as separate
  templates) with column mapping, validation, duplicate review, and time-bounded undo.
- QuickBooks OAuth connect for invoices/payments — **planned, not yet implemented**; no
  QuickBooks/OAuth integration exists in the codebase today, and it must be built and
  separately approved before it is part of the Founder Preview or any release.
- Minimal guided quick-add for contractors with no prior data source.
- Email-based team invite for dispatcher/technician roles, matching the currently
  implemented invite flow (see Team setup, above) — not a broader owner/admin or
  phone-based invite, which are future work.
- The Tier 1/Tier 2/Tier 3 command-center hierarchy, built from data TradeOS already
  models today (jobs/scheduling, invoices, estimates, proposals, change orders, supplier
  price-review queue).

Explicitly aspirational, not realistic for MVP:

- Live, automated, bidirectional API-based data sync directly from ServiceTitan,
  Jobber, Housecall Pro, or Buildertrend — these require formal, gated partner-API
  agreements TradeOS does not currently hold. The realistic substitute is each
  platform's own CSV/Excel export run through TradeOS's generic importer.
- Any Buildertrend migration path beyond manual/concierge-assisted entry, since the
  platform does not offer self-serve bulk export.
- Automated attachment/photo migration at scale.
- AI-driven historical-data reconciliation (fuzzy cross-source matching without human
  confirmation) — MVP dedupe must remain rule-based (exact/fuzzy match with human
  confirmation), not silent ML auto-merge.
- Voice commands that write structured data (quantities, change-order line items)
  without a confirm-before-commit step.
