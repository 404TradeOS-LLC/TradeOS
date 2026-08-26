---
status: archived
superseded_by: docs/README.md
do_not_use_for_implementation: true
---

# TradeOS Cost Book — Front-End, CRM, PDF, and AI-Assisted Estimating Completion Plan

**Status of this document:** This is a planning artifact, not yet executed. It complements (does not replace) `docs/TradeOS-CostBook-Architecture.docx` and `docs/TradeOS-CostBook-Wireframe-Module-Spec.docx`, which already define the original wiretree, user flows, and 12-module specification this backend was built against. Where this plan adds scope beyond those documents (AI-assisted estimating, a separate Invoice entity, e-signature contracts), it says so explicitly rather than silently expanding the product.

## 0. What Already Exists (read this before estimating anything below)

The backend is substantially further along than a typical "MVP backend" — this changes the shape of the remaining work from "build everything" to "build the UI and a handful of genuinely new server-side features on top of a working platform."

**Already built and deployed** (Express/TypeScript/Prisma, PostgreSQL via Supabase, live at `https://tradeos-costbook.vercel.app`):

| Capability | State |
|---|---|
| Multi-tenant data isolation | Forced PostgreSQL row-level security, not just app-level filtering. Real, audited. |
| Auth | Bearer JWT (HS256), org-membership RBAC (`owner`/`admin`/`estimator`/`viewer`). No login UI yet — token issuance currently only via dev seed script / platform provisioning. |
| Cost Database (Divisions→Categories→Subcategories→Cost Items), Labor, Material, Equipment, Assemblies (+ reusable templates), Estimate Engine, Proposal Generator (PDF via `pdfkit`), Admin Dashboard, Change Orders, Supplier Integrations | All built, tested (93 unit + 11 live-RLS integration tests), with a full REST API under `/api/v1/*`. |
| Production infra | Tracked Prisma migrations, idempotent role provisioning, GitHub Actions deploy workflow, live on Supabase + Vercel. |
| Admin UI | Server-rendered internal HTML pages only (`/admin`, `/admin/pricing-history`, `/admin/member-history`) — these are ops tooling, not the contractor-facing product. |

**Explicitly not built yet** (this plan exists to close these gaps):

- Any customer-facing UI at all.
- Sign-up / sign-in / onboarding flow (the backend can verify a token; nothing issues one to an end user yet).
- E-signature.
- Reporting & Analytics module.
- Full customer-facing invoice delivery / payment workflow UI.
- Full customer-facing contract review / signature workflow UI.
- **AI-assisted estimating** — not in the original spec at all. Entirely new.
- Broader CRM features (lead pipeline, follow-up tasks, communication log) beyond the existing minimal Customer/Project records.

## 1. Scope & Objectives

**Target users:** Owners/estimators at small-to-medium trade contracting businesses (1–50 employees) — GC, remodel, deck, roofing, concrete, excavation, landscaping, fencing, plumbing, HVAC, electrical. Assume low technical sophistication, high time pressure, and frequent on-the-go (tablet/phone) usage in the field. Design for "fast enough to use between job-site visits," not "feature-complete enterprise software."

**Outcomes for this phase:**
1. A working, intuitive web app a contractor can use end-to-end: log in → manage clients/projects → build an estimate (with AI assistance) → generate a polished proposal/invoice/contract PDF → send it.
2. AI-assisted estimating that meaningfully reduces the time to build a first-draft estimate from a plain-English scope description, using the org's *own* cost book (not generic AI pricing).
3. A CRM layer thin enough to ship fast but real enough that contractors stop using a separate spreadsheet/CRM for client tracking.

The first AI Estimate Assist milestone is now implemented in code: the estimate assist page no longer uses client-only mock data and instead calls a scoped backend suggestion endpoint backed by the org's active cost book.

## 2. Feature Breakdown

### Must-have (this phase's MVP front-end)
- **Auth & onboarding**: sign up (creates org + owner, via the existing `/api/v1/platform/organizations` provisioning endpoint), sign in, the onboarding wizard already specified in the wireframe doc (company profile, region, default overhead/profit, trade-starter cost book seed).
- **Dashboard**: active estimates, recent proposals, quick-create actions. (Spec'd; not built.)
- **Client management**: list/detail/edit for `Customer` — the API only has list/create/get today (`/api/v1/customers`); **edit and soft-delete need to be added server-side.**
- **Project management**: list/detail/status-change — API exists (`/api/v1/projects`), needs an edit endpoint added.
- **Estimate Builder**: line-item editor, Cost Item/Assembly picker (the picker should surface `isTemplate` assemblies prominently — that mechanism is already built specifically to make this fast), overhead/profit panel, running summary. Fully backed by the existing Estimate Engine API.
- **AI-assisted estimate drafting**: scope-of-work text box → suggested line items against the org's real cost book. New capability (Section 5).
- **Proposal generation & send**: wraps the existing PDF generator; delivery/status tracking is now persisted server-side through `proposal_deliveries` plus proposal lifecycle timestamps and can be consumed by the frontend without inventing a second timeline.
- **Invoice generation**: distinct entity and PDF template, with persisted server-side lifecycle history (`invoice_deliveries`) so the frontend can show sent/paid/voided activity without reconstructing it.
- **Contracts**: a signable document derived from an accepted Proposal, with persisted server-side signing/void history (`contract_events`) for project detail and future customer-facing workflows.
- **Settings**: company profile/branding, users & permissions (the role model already exists server-side — this is just exposing it in UI), regions & pricing adjustments, supplier integrations (already has a real review-queue UI's worth of API behind it).

### Nice-to-have / later phases
- Scheduling/calendar (crew/job scheduling — not in any existing spec).
- Payment tracking/processing (Stripe or similar) against invoices.
- Reporting & Analytics module (already spec'd as Module 12, explicitly deferred originally).
- Mobile app (native) — start responsive-web first.
- Live supplier price-feed ingestion (the queue/review backend exists; only the actual feed connector is stubbed).
- Multi-language support.

## 3. User Flows & Wireframes

Use the existing wiretree and page annotations in `docs/TradeOS-CostBook-Wireframe-Module-Spec.docx` (Deliverable 1) as the baseline — don't re-derive it. Summary of the additions this plan requires on top of that baseline:

- **New page: AI Estimate Assist**, inserted into the Estimate Builder flow between "open empty estimate" and "manually add line items": a scope-of-work textarea, a "Generate Suggestions" action, and a review list (suggested cost item/assembly + quantity + confidence) the estimator accepts/edits/rejects line-by-line before anything is committed to the estimate. AI output is always a *draft the human approves*, never auto-committed.
- **New page: Invoices** (parallel structure to Proposals): Invoice List → Invoice Detail/Editor (can reference 100% of an estimate, a subset, or be progress-billed) → Invoice Send.
- **New page: Contract Review & Sign**: presented after a Proposal is marked "accepted" — renders contract terms, captures a signature (typed name + drawn signature + timestamp/IP, or a third-party e-sign integration), produces a final signed PDF.
- **Extended: Proposal Status Tracking** on Project Detail, now showing sent/viewed/signed/expired states with timestamps.

Core flow, updated:

```
Dashboard → New Estimate → select/create Customer + Project
  → Estimate Builder
      → [AI Estimate Assist: paste scope → review/accept suggested line items]
      → [manual: Cost Item/Assembly Picker as today]
      → Overhead & Profit Panel
  → Preview Proposal → Send
  → (customer accepts) → Contract Review & Sign
  → Invoice (full or progress) → Send → (payment, later phase)
```

## 4. Technical Architecture & Stack

**Front-end stack:** React + TypeScript, **Next.js** (App Router) rather than a bare SPA — gives you file-based routing, server components for the parts that don't need client interactivity (dashboards, lists), and a natural deployment target on Vercel right next to the existing API. Pair with **shadcn/ui** (Tailwind-based, unstyled-but-accessible primitives) over a heavier component library like MUI/Ant — better fit for a fast-moving small product, easier to make look distinctive rather than generic-admin-panel.

**State/data layer:** TanStack Query for server-state (caching, refetching, optimistic updates against the REST API) rather than a global client-state library — this app is almost entirely "fetch from API, mutate, refetch," which is exactly TanStack Query's sweet spot. Reserve Zustand/Context for genuinely client-only state (estimate-builder draft-in-progress before save, wizard step state).

**API integration:** The backend is REST, not GraphQL — keep it that way; introducing GraphQL now would be a rewrite with no clear payoff at this scale. Auth: store the bearer JWT in an httpOnly cookie set by a thin Next.js API route that proxies the sign-in call (avoids exposing the token to client-side JS). All API calls go through one typed client module (`lib/api.ts`) wrapping `fetch`, centralizing the `Authorization` header, `x-org-id` header, and a single error-shape parser (the backend's `errorHandler` already returns a consistent `{ error, details? }` JSON shape — match it on the client).

**PDF generation:** Keep it server-side. `modules/proposal-generator` already generates Proposal PDFs via `pdfkit`; extend the same pattern for Invoices and signed Contracts rather than introducing a second, client-side PDF library (`react-pdf`/`jsPDF`) — that would mean maintaining two rendering engines and two sources of truth for what a proposal looks like. The front-end's job is to call `POST /api/v1/proposals/:id/generate` (and the new invoice/contract equivalents) and display/download the returned PDF.

**Deployment:** Same Vercel project family as the API, but as a **separate Vercel project** (see Section 7) — Next.js front-end calling the existing Express API over HTTPS, not merged into one deployable.

## 5. AI-Assisted Estimating Integration

**Input:** A contractor pastes/types a plain-English scope of work (e.g., "Tear out and replace 250 sq ft of cracked concrete driveway, 4 inch slab, broom finish").

**Pipeline:**
1. Send the scope text + the org's actual cost book context (division/category/subcategory names, a relevant subset of cost item names/codes/units — not raw pricing, to keep the prompt small and avoid leaking sensitive cost data into a third-party model unnecessarily) to an LLM.
2. Prompt the model to map the scope to **existing cost item/assembly codes** plus an estimated quantity, not to invent new pricing — the model's job is matching and quantity-estimating, never pricing (pricing always comes from the org's own Cost Database/Estimate Engine, server-side, so numbers stay correct and auditable).
3. Return suggestions as `{ costItemId | assemblyId, suggestedQuantity, confidence, rationale }[]`.
4. Render as a review list in the new AI Estimate Assist page; the estimator accepts/edits/rejects each row. Accepted rows call the existing `POST /api/v1/estimates/:id/line-items` exactly as a manual add would — **the AI never writes to the database directly.**

**Feedback loop:** Log every suggestion alongside the estimator's accept/edit/reject decision (new table, e.g. `ai_estimate_suggestions`). This is the dataset for later fine-tuning/prompt-improvement — start simple (a logging table + periodic manual review of rejection patterns), don't build an automated retraining pipeline in this phase.

**Implementation notes:**
- New backend module, e.g. `modules/ai-estimate-assist/`, following the existing module pattern (`types.ts` + `service.ts`), with a new controller/route `POST /api/v1/estimates/:id/ai-suggestions`.
- Use the Vercel AI SDK for the LLM call (already in the Vercel ecosystem this app is deployed in) with a tool-calling/structured-output schema matching the suggestion shape above, so the model can't return malformed data.
- This must run org-scoped under the same RLS-aware request session as everything else — the cost-book context sent to the model is fetched via the existing `CostDatabaseService`/`AssembliesDatabaseService`, inside the normal authenticated request flow.

## 6. Data & State Management

- **Server state**: TanStack Query, keyed by resource (`['estimates', estimateId]`, etc.), with mutations invalidating the relevant queries. No client-side duplication of server data beyond what's needed for optimistic UI.
- **Estimate Builder draft state**: line items being added/edited before each individual save are genuinely client-local — model as local component/Zustand state, persisted to `localStorage` so an accidental tab close doesn't lose an in-progress edit, then synced to the server on explicit save (matches the backend's existing draft/finalize estimate-status model).
- **Real-time**: not required for this phase. The estimate/proposal/invoice domain is single-editor-at-a-time in practice for a small contractor org; don't build multiplayer sync infrastructure (e.g. WebSockets/CRDT) until there's evidence multiple estimators are editing the same estimate concurrently. Polling/refetch-on-focus via TanStack Query is sufficient.
- **Sessions**: httpOnly cookie holding the bearer JWT, refreshed via a `/api/auth/refresh`-style Next.js route if the backend's tokens are short-lived (check `AUTH_JWT_SECRET` token expiry policy — currently tokens appear to carry no `exp` enforcement pattern in the codebase beyond what's signed in; confirm and add expiry handling before shipping auth UI).

## 7. Repository & DevOps Strategy

**Separate repo or folder, not a merged deployable.** Recommend: keep the existing `TradeOScostbook` repo, add a sibling top-level `web/` directory (Next.js app) alongside `app/` (the existing Express API) — same repo (easier cross-referencing of API contracts, one PR can touch both sides of a feature), but two independent Vercel projects/deployments. Do **not** try to merge the front-end into the existing `app/` Vercel project — that project is already configured as a zero-config Express deployment (a real, hard-won configuration this session — see the "Express on Vercel" collision with the `api/` directory naming convention, documented in the session log); bolting Next.js onto it risks re-triggering exactly that class of platform-convention conflict.

**CI/CD:**
- Extend the existing GitHub Actions setup with a second workflow for the front-end: lint → typecheck → build → (Vercel's own GitHub integration handles preview deployments per-PR automatically once the `web/` project is connected — don't hand-roll deploy steps Vercel already does for free).
- Keep the existing `deploy-migrations.yml` pattern for the database; the front-end has no database migrations of its own.
- Add a staging environment: Vercel's Preview deployments per-PR already give you this for the front-end; for the API, consider a second Supabase branch (the Supabase MCP tooling already used in this project supports `create_branch` for exactly this) pointed at by a `preview` Vercel environment on the API project.

## 8. Phased Roadmap & Timeline

Rough estimates assume 1–2 full-time engineers; adjust for actual team size.

| Phase | Scope | Rough estimate |
|---|---|---|
| **0. API gaps** | Close any remaining contract-alignment gaps while UI build proceeds; core customer/project edits, proposal delivery tracking, invoice lifecycle history, and contract event history are now present server-side | 1–2 weeks |
| **1. Auth & shell** | Sign up/in, onboarding wizard, Next.js app shell, API client, design system setup | 2–3 weeks |
| **2. Core CRM + Estimate Builder** | Client/project management, full Estimate Builder (manual path), Proposal preview/send | 4–6 weeks |
| **3. AI-assisted estimating** | Scope-to-suggestions pipeline, review UI, suggestion logging | 2–3 weeks |
| **4. Invoices & Contracts** | New entities, PDF templates, e-signature integration | 3–4 weeks |
| **5. Settings & polish** | Company profile/branding, users & permissions UI, regions/supplier-integration UI, responsive/mobile QA | 2–3 weeks |
| **6. Later phases (not this plan's scope)** | Scheduling, payments, analytics, native mobile | — |

Phases 1–2 can start in parallel with Phase 0 once the relevant endpoint contracts are agreed, since most of Phase 2's reads (cost book, estimates, assemblies) are already fully built.

## 9. Risks & Mitigation

- **AI suggestions feel wrong/untrustworthy to contractors.** Mitigate by always treating suggestions as drafts requiring explicit accept-per-line, showing the matched cost item code/name (not a black box), and logging rejections to iterate on prompt quality quickly.
- **Scope creep from "CRM"/"Invoices"/"Contracts" turning into a full accounting/e-sign rebuild.** Mitigate by deliberately keeping Invoices as billing documents against existing estimates (not a general ledger) and using a third-party e-signature API (DocuSign/HelloSign-class) rather than building signature-capture/legal-compliance infrastructure in-house.
- **Repeating the Vercel deployment-convention issues hit this session** (Express-zero-config detection, the reserved `/api` directory collision, Prisma+Vercel build caching). Mitigate by keeping the front-end as a genuinely separate Vercel project (Section 7) and treating Next.js's own, well-trodden Vercel deployment path as the default — don't hand-roll config there.
- **User adoption/training**, given the explicitly non-technical target user. Mitigate with the onboarding wizard already spec'd, in-product empty-states that explain what to do next (rather than blank screens), and treating the AI estimate-assist feature as the primary "wow, this is fast" hook for adoption.
- **RLS/multi-tenancy correctness on new endpoints** (invoices, contracts, AI suggestions). Mitigate by following the existing pattern exactly: every new table gets the same forced-RLS treatment as the rest of the schema, verified the same way (a live RLS integration test, not just unit tests with mocked Prisma) before shipping.

## 10. Documentation & Testing

- **Developer docs**: extend the existing `app/README.md` pattern — a `web/README.md` covering setup, the API client contract, and the AI suggestion pipeline's prompt/schema.
- **User guides**: short in-product help (tooltips, an onboarding checklist) over a separate help-center site for this phase — the target user is unlikely to read external docs.
- **Testing strategy**:
  - Unit tests for new backend modules (invoices, contracts, AI suggestion service) following the existing Jest pattern (mocked Prisma) — this codebase already has 93 passing unit tests in this style; match it.
  - Live RLS integration tests for every new table, matching the existing `tests/rls.integration.ts` pattern — non-negotiable given this app's security model is RLS-first.
  - Front-end: component tests for the Estimate Builder and AI Assist review flow (the highest-complexity, highest-risk UI), plus a handful of Playwright end-to-end tests covering the core "sign up → estimate → proposal" loop — the project already has Playwright wired up for the admin-shell screenshot tooling (`app/.claude/skills/run-tradeos-costbook-api/`), so the team already has working headless-browser infrastructure to extend rather than introduce from scratch.
  - User acceptance testing: before wider rollout, run the core flow live with 2–3 real contractors from the target trades, specifically watching for AI-suggestion trust/comprehension issues and mobile/tablet usability, since those are the two highest-uncertainty parts of this plan.
