# Contractor UX Polish

> **Provenance note:** this document was recovered from an orphaned local
> branch (`worktree-contractor-ux-polish`, commit `d409cdb`) that predates
> the RC1.2 job-scheduling and Blueprint design-system work (PRs #19–#21).
> It's a historical record of a specific past UX polish pass, not a living
> spec. Several of the files it references — notably
> `web/src/components/shared/app-nav.tsx`, `activity-timeline.tsx`, and
> `ai-estimate-assist.tsx` — have since been substantially reimplemented, so
> the per-file descriptions below may no longer match current code. The
> design rationale (why certain copy/UX changes were made) is still useful;
> the file-level specifics should be treated as historical, not current.

Scope: `web/` only. Polish pass aimed at making the existing frontend easier
for a non-technical contractor to use. No new features, no backend changes,
no redesign — existing screens only.

## Approach

An audit pass first read every page and component under `web/src` and
grouped findings into: navigation, page titles, empty states, loading
states, form labels, buttons, mobile layout, estimate workflow clarity, and
project workflow clarity. The fixes below address the highest-impact,
lowest-risk findings from that audit.

## Files changed

**New files**

- `web/src/components/shared/app-nav.tsx` — client nav with active-route highlighting
- `web/src/components/ui/confirm-button.tsx` — confirm-before-submit wrapper for destructive form buttons
- `web/src/components/ui/required-mark.tsx` — shared "*" required-field indicator
- `web/src/app/(app)/loading.tsx` — friendly loading fallback for the app shell
- `web/src/app/(app)/not-found.tsx` — friendly 404 page instead of the framework default
- `web/src/app/(app)/customers/new/layout.tsx`, `web/src/app/login/layout.tsx`, `web/src/app/signup/layout.tsx` — thin server layouts so client-component pages can still set a page title

**Edited**

- `web/src/app/layout.tsx` — title template (`%s · TradeOS Cost Book`)
- `web/src/app/page.tsx` — title + a visible "Sign in" link out of the marketing/demo landing page
- `web/src/app/(app)/layout.tsx` — wired in the new active-state nav
- `web/src/app/login/page.tsx`, `web/src/app/signup/page.tsx` — required-field markers, password hint
- `web/src/app/(app)/dashboard/page.tsx` — page title, honest metric copy, de-duplicated CTA label
- `web/src/app/(app)/customers/page.tsx`, `web/src/app/(app)/customers/new/page.tsx`, `web/src/app/(app)/customers/[id]/page.tsx`, `web/src/app/(app)/customers/[id]/edit-form.tsx` — titles, back link, empty-state CTA, confirm-before-remove, required markers
- `web/src/app/(app)/projects/page.tsx`, `web/src/app/(app)/projects/new/page.tsx`, `web/src/app/(app)/projects/new/form.tsx`, `web/src/app/(app)/projects/[id]/page.tsx`, `web/src/app/(app)/projects/[id]/edit-form.tsx` — titles, back link, consistent status badges, required markers
- `web/src/app/(app)/projects/[id]/invoices/new/page.tsx`, `.../invoices/new/form.tsx`, `.../invoices/[invoiceId]/page.tsx` — title, back link, plain-language estimate picker, status badge instead of raw text, confirm-before-void
- `web/src/app/(app)/projects/[id]/proposals/new/page.tsx`, `.../proposals/new/form.tsx`, `.../proposals/[proposalId]/page.tsx` — title, clearer heading, plain-language estimate picker
- `web/src/app/(app)/projects/[id]/contracts/[contractId]/page.tsx`, `.../sign-form.tsx` — title, heading includes project name, confirm-before-void, plain-language signature audit labels, required marker
- `web/src/app/(app)/projects/[id]/estimates/[estimateId]/page.tsx`, `.../builder.tsx`, `.../assist/page.tsx` — titles, plain-language heading, markup-vs-margin explanation, finalize-action explanation, non-blocking loading state
- `web/src/app/actions/projects.ts` — removed an internal "MVP upload flow" phrase from a user-facing error message
- `web/src/components/projects/project-workspace.tsx` — de-duplicated dead-end quick actions, confirm-before-status-change, confirm-before-remove-task, removed a leaked engineering caveat from the warranty tab, fixed a raw "Placeholder" GPS value
- `web/src/components/projects/project-header.tsx` — mobile-safe action column width
- `web/src/components/projects/project-workspace-tabs.tsx` — mobile scroll-affordance fade edges
- `web/src/components/projects/project-photo-panel.tsx` — de-duplicated empty-state title, plain-language file-source captions, confirm-before-delete
- `web/src/components/projects/site-visit-form.tsx` — removed "GPS placeholder", "Transcript-ready field", and a Supabase/MVP engineering note from user-facing labels/help text
- `web/src/components/proposals/proposal-lifecycle-panel.tsx` — "Mark accepted/rejected" reworded to "Customer accepted/declined"
- `web/src/components/intake/ai-missing-information-panel.tsx` — removed "MVP workflow" from empty-state copy
- `web/src/components/estimate-assist/ai-estimate-assist.tsx` — removed "Sprint 9", "RAG", "Knowledge Engine runtime", and "Estimate Engine write path" internal jargon from contractor-facing copy
- `web/src/components/contracts/signature-pad.tsx` — `touch-action: none` so signing on a phone doesn't scroll the page
- `web/src/components/shared/activity-timeline.tsx` — added a missing empty state
- `web/src/components/ui/select-field.tsx` — shows the required marker automatically when the field is required

## UX issues fixed

**Navigation**
- Main nav (Dashboard/Customers/Projects) now highlights the active section.
- Added "back to customers" and "back to projects" links on detail pages that lacked them.
- Added a back link from "New invoice."
- Added a visible sign-in entry point from the root marketing/demo page (it previously had none).
- Removed three field-dashboard buttons ("Take photo," "Start visit," "End visit") that all silently pointed at the same generic intake page; merged into one honestly-labeled "Log site visit" action. Same fix for "Record change" / "Generate change order," which both pointed at the same tab.

**Page titles**
- The whole app previously shared one browser-tab title ("TradeOS Trainingless AI Estimating Demo"). Every real page now has its own descriptive title (customer name, project name, invoice number, "Dashboard," "Estimate builder," etc.) via a shared title template.

**Empty states**
- `ActivityTimeline` silently rendered nothing when empty; now shows "Nothing to show here yet."
- Customer detail's "no projects yet" now includes a "Create a project" button instead of a dead end.
- Fixed a duplicated heading in the photo panel's empty state.

**Loading states**
- The estimate builder's loading state used to replace the entire page (including the back link) with plain text; it now keeps navigation visible and shows a small spinner.
- Added a shared `loading.tsx` and a friendly `not-found.tsx` for the authenticated app shell.

**Form labels**
- Removed internal/engineering language that had leaked into user-facing copy: "GPS placeholder," "Transcript-ready field," a Supabase/MVP note on photo uploads, "Sprint 9," "RAG," "Knowledge Engine runtime," "MVP workflow," a raw "Placeholder" GPS value, and an "MVP upload flow" error message.
- Added a consistent required-field asterisk (`RequiredMark`) to every field that already had a `required` attribute but no visual indicator (name fields, email/password on login and signup, signer name, estimate picker).

**Buttons**
- Destructive actions (remove customer, void invoice, void contract, delete photo, remove task) now ask for confirmation before submitting, instead of firing immediately on click.
- Changing a project's lifecycle status now confirms first, since it's a single click that can jump straight to "Archived."
- Dashboard's "Open project workspace" button (which just opened the plain projects list) renamed to "View all projects" to match what it actually does.
- Proposal "Mark accepted" / "Mark rejected" renamed to "Customer accepted" / "Customer declined" to read as a customer decision rather than an internal toggle.

**Mobile layout**
- Fixed a real functional bug: the contract signature pad had no `touch-action`, so signing with a finger on a phone would also scroll the page.
- The project header's action-button column no longer forces a minimum width that could crowd the title on small screens.
- The workspace tab strip now shows a fade edge on mobile hinting that more tabs are scrollable off-screen.

**Estimate workflow clarity**
- Estimate heading changed from developer-style "Estimate v2" to "Draft Estimate #2" everywhere it appears (builder, estimate history list, change-order picker, invoice/proposal pickers).
- Added a plain-language explanation of markup vs. target margin, what "assemblies" vs. "cost items" means, and what "Finalize estimate" actually does before locking the estimate.
- Raw status strings like "draft"/"finalized" in the estimate picker dropdowns are now capitalized.

**Project workflow clarity**
- Projects list now uses the shared `StatusBadge` (capitalized, spaced) instead of a raw enum string like `active_job`.
- Invoice detail's status line now uses the same badge component as the rest of the page instead of raw text.
- Removed an internal engineering caveat from the customer-facing Warranty tab.
- Dashboard's permanently-fake "AI suggestion acceptance: Not logged" metric reworded to "Not tracked yet"; "Knowledge coverage" renamed to "Cost book coverage."

## Remaining friction points (not addressed in this pass)

- The project workspace still has 14 tabs (Overview, Estimate History, Proposals, Contracts, Invoices, Photos, Documents, Site Visits, Tasks, Change Orders, Timeline, Warranty, Notes, Activity) with real overlap in purpose (Documents vs. Photos, Notes vs. Site Visits, Timeline vs. Activity). Consolidating this is an information-architecture decision beyond a polish pass.
- Login/signup have no "forgot password" link or recovery path — there is no backend endpoint for it yet, so this is a feature gap, not a polish fix.
- The estimate builder's "Markup %"/"Target margin %" toggle is now explained in text, but a first-time user still has to read it; a short inline example (e.g., "$100 cost at 20% markup = $120 price") would help more but starts to edge into redesign.
- The AI Estimate Assist screen is UI-only (mock/local data per existing project notes) — its copy is now jargon-free, but the feature itself doesn't call a real backend yet.
- No dedicated empty/loading states were added inside individual workspace tabs beyond what already existed (each tab already had some form of "No X yet" text; only the ones that were fully missing were fixed).
- The root `/` route is a large, separate marketing/demo experience (`TraininglessDemoApp`) that is out of scope for "polish existing contractor screens" — it now has a way back into the real app (a "Sign in" link) but its internal copy/IA was left untouched.

## Suggested commit message

```
polish(web): improve contractor-facing UX across navigation, forms, and workflows

Add active nav state, per-page titles, required-field markers, and
confirm-before-destructive-action prompts; remove leaked engineering
jargon from user-facing copy; fix a mobile touch-scroll bug on the
signature pad; clarify estimate markup/margin language; add missing
empty/loading states. No backend or feature changes.
```

## Verification

```
cd web && npm run lint && npm run build
```

Both pass with no errors (one pre-existing-pattern lint warning was fixed
along the way). Live browser verification was not performed in this pass —
the backend/database were not running in this environment — so this is a
static/build-level check only, not a full click-through QA pass.
