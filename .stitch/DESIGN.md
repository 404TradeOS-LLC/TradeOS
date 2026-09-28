# TradeOS Product Design Contract

**Status:** Canonical written design contract for TradeOS product UI.  
**Canonical Figma:** file key `xImUa9CYUjx3Cb3zTrkfnY` — `[CANONICAL] TradeOS — Product + Design System Source of Truth`.  
**Last reconciled:** 2026-09-27.

This file is the written companion to the canonical Figma master. It is intentionally not a screen-by-screen replacement for Figma. It defines the permanent visual system, interaction grammar, product language, responsive rules, reusable patterns, and implementation boundaries that frontend work must preserve.

## 1. Authority model

TradeOS has three kinds of truth. Keep them separate and synchronized.

1. **Capability truth** — governed product/domain contracts and live implementation define what TradeOS can actually do: routes, persisted state, lifecycle, permissions, mutations, money, security boundaries, and data contracts.
2. **Design truth** — the canonical Figma file defines approved product hierarchy, visual intent, responsive composition, reusable components, interaction patterns, screen states, and current approved product screens.
3. **Implementation truth** — current production code defines exact implementation values and accessibility behavior. In particular, `web/src/app/globals.css`, shared production components, and live route/domain contracts govern exact runtime behavior.

Historical Sites work, old Figma files, sprint packets, screenshots, and archived design explorations are **reference only** unless deliberately reconciled and approved into the canonical Figma file.

If sources conflict:

- never invent a compromise;
- capability truth wins over a mockup that implies unsupported behavior;
- canonical Figma wins for current design intent;
- production code wins for exact runtime/token/accessibility details until a deliberate design decision changes them;
- reconcile the affected source in the same change instead of allowing silent drift.

`docs/ui-guide.md` is the current production component/integration inventory. It complements this contract; it does not replace the canonical Figma design system.

## 2. Product intent

TradeOS is **the contractor operating system**.

The product should feel like a contractor command center: simple enough to understand at a glance, powerful enough to run a real contracting business, and precise enough to inspire trust.

Core principles:

- **Action before analytics.** Show what needs attention and what to do next before historical metrics.
- **One dominant next move.** Focused workflows should have one obvious primary action.
- **Workspaces over card walls.** Important records are operating surfaces, not dashboards made from miniature dashboards.
- **Calm under load.** Dense information is acceptable; visual chaos is not.
- **Operational language.** Use contractor language, not generic SaaS or AI jargon.
- **Real data over decoration.** Never fabricate metrics, prices, integrations, telemetry, engagement, customer intent, status, or risk.
- **Progressive disclosure.** Reveal detail when it becomes relevant to the current decision.
- **Mobile-first field ergonomics.** Primary actions must remain understandable and thumb-reachable on a phone.
- **Accessible by construction.** Contrast, focus, motion, touch targets, keyboard behavior, and semantic state are design requirements.
- **Intelligence inside the work.** Athena belongs inside workflows and records, not as a generic chatbot bolted onto the product.

When in doubt, cut rather than add.

## 3. Canonical Figma structure

The canonical Figma file uses one working master:

- `00 — Product Design Cover`
- `01 — Getting Started`
- `02 — Foundations`
- `03 — Components`
- `04 — Patterns`
- `10 — Today`
- `11 — CRM`
- `12 — Customer`
- `13 — Lead`
- `14 — Estimates`
- `15 — Jobs`
- `16 — Schedule`
- `17 — Money`
- `18 — Costbook`
- `19 — Athena`
- `20 — Customer Portal`
- `21 — Settings`
- `22 — Onboarding`
- `90 — Mobile`
- `91 — States`
- `99 — Archive`

Do not create a second design-system file, a second product-screen authority, or an alternate component library for TradeOS.

## 4. Visual environments

### Blueprint

Blueprint is the default product environment:

- warm-neutral light surfaces;
- charcoal/graphite text;
- restrained copper interaction/brand accent;
- compact engineered spacing;
- strong hierarchy without visual noise;
- borders doing most structural separation;
- shadows reserved mainly for floating layers.

### Carbon

Carbon is product dark mode. It preserves the same hierarchy, semantics, interaction model, information priority, and accessibility quality as Blueprint. It is not a separate product aesthetic.

### Forge

Forge is the more dramatic marketing/brand language. Keep Forge on marketing and brand-storytelling surfaces. Normal contractor workflows must not drift into Forge styling.

## 5. Color and token rules

Use semantic production tokens, not one-off colors.

Canonical semantic roles include:

- `color/surface/app` — page/app environment;
- `color/surface/workspace` — primary record/work surface;
- `color/surface/secondary` — grouped supporting work;
- `color/surface/subtle` — quiet supporting treatment;
- `color/action/primary` — primary action/brand interaction;
- `color/text/primary`;
- `color/text/secondary`;
- `color/status/info`;
- `color/status/success`;
- `color/status/warning`;
- `color/status/destructive`;
- `color/border/default`.

Semantic colors keep semantic meaning:

- green = success / complete / healthy;
- amber = warning / caution / attention;
- red = destructive / failed / genuinely critical;
- blue = informational / neutral system state;
- copper = brand / primary interaction.

Do not create a rainbow dashboard by assigning arbitrary colors to sections or record types.

Exact values, accessible foreground pairings, focus rings, and dark-mode values come from production tokens. The supplied brand-mark artwork has its own approved artwork copper and must not be used as a reason to rewrite product theme tokens.

## 6. Surface hierarchy

Use three product surface levels before inventing another container treatment:

1. **App canvas** — broad page/environment separation using `color/surface/app`.
2. **Workspace** — the main record or production surface using `color/surface/workspace`.
3. **Secondary / subtle** — related supporting work using `color/surface/secondary` or `color/surface/subtle`.

Cards are components placed on these surfaces. They are not a fourth surface system.

Use borders for most separation. Reserve stronger elevation for menus, sheets, popovers, dialogs, and temporary overlays.

## 7. Typography

Canonical families:

- **Space Grotesk** — headings and selected brand/display moments;
- **Inter / product system sans** — normal product UI, controls, labels, navigation, and body copy;
- **IBM Plex Mono / mono role** — money, IDs, timestamps, measurements, and operational data where alignment improves scanning.

Canonical scale from the Figma foundations:

- Page large — 30 px Space Grotesk Medium;
- Page — 24 px Space Grotesk Medium;
- Section — 18 px Space Grotesk Medium;
- Record heading — 16 px Space Grotesk Medium;
- Body large — 16 px Inter Regular;
- Body default — 14 px Inter Regular;
- Body strong — 14 px Inter Medium;
- Metadata — 12 px Inter Regular;
- Eyebrow/label — 12 px Inter Semi Bold;
- Money large — 24 px IBM Plex Mono SemiBold;
- Mono small — 12 px IBM Plex Mono.

Production primitives may use documented compact additions such as 14/20 semibold body, 14/20 compact headings, and compact control typography. Do not introduce a second unrelated type scale.

## 8. Spacing, radius, and elevation

Canonical spacing is a compact 4/8-based rhythm with documented operational steps:

- 4
- 8
- 12
- 16
- 20 when a current production primitive specifically requires it
- 24
- 32
- 48

Canonical radius roles are derived from the production base scale:

- small ≈ 4.8 px
- medium ≈ 6.4 px
- large = 8 px
- XL ≈ 11.2 px
- 2XL ≈ 14.4 px
- 3XL ≈ 17.6 px
- 4XL ≈ 20.8 px
- full = pill only when semantically justified

Do not reintroduce the older separate “frame/input/button/card” radius scale that conflicts with the current production-aligned foundation.

Borders carry structure. Elevation should not be the default method of grouping content.

## 9. Responsive contract

Design for these checkpoints:

- **390 px — field workflow.** One-handed priority. One dominant action in focused stages.
- **768 px — tablet split.** Use split views only when both panes materially help the task.
- **1024 px — compact desktop.** Preserve production density without collapsing hierarchy.
- **1440 px — command center.** Use width for context, relationships, provenance, and operational visibility — not more card clutter.

Responsive rule: **preserve content priority, not desktop geometry.**

On smaller widths, context rails become sheets or sections before the primary work surface becomes cramped.

## 10. Canonical reusable components

The canonical Figma component library currently includes:

- `Button`
- `Badge`
- `StatusBadge`
- `Input`
- `RecordRow`
- `WorkspaceHeader`
- `AttentionItem`
- `PricingProvenance`
- `Label`
- `Checkbox`
- `Textarea`
- `Card`
- `SelectField`
- `EmptyState`
- `ControlDock`
- `StickyTaskAction`

### Implementation alignment

Current production has related primitives that must converge instead of multiplying:

- Figma `RecordRow` aligns with / should converge with production `ListRowLink`;
- `WorkspaceHeader` should converge with existing page/project header responsibilities without making every simple list page heavy;
- `AttentionItem` is the shared responsive unresolved-action row for Today and any future expanded Needs You surface;
- `PricingProvenance` is the shared trust primitive for Costbook, Assemblies, and Estimate Items;
- `ControlDock` maps to the production mobile shell owned by `AppNav`;
- `StickyTaskAction` formalizes the repeated one-primary-action mobile pattern.

Do not create a second component because the current production abstraction is slightly narrower. Converge it deliberately.

## 11. Control Dock and mobile shell

The canonical mobile Control Dock has exactly five thumb-reachable slots:

**Today · Dispatch · Create · Work · More**

Rules:

- Create is the centered copper action.
- Active destination gets the brand-subtle treatment.
- Dispatch may show a real attention count only when backed by live data.
- Do not add decorative notification dots.
- Secondary navigation belongs under More rather than expanding the dock.
- The dock is a shell contract, not a per-screen invention.

### Sticky task action

Use `StickyTaskAction` only when one bottom action materially advances the current mobile task, for example:

- Save Expense;
- Approve Change;
- Record Payment;
- Use in Estimate;
- Continue to next estimate stage.

It sits above the Control Dock with safe-area clearance.

If the content already contains a strong primary CTA, do not add a second copper action merely because mobile has room.

### Bottom Sheet contract

Create, More, and other appropriate secondary mobile controls use the same bottom-sheet behavior:

- safe-area padding;
- body-scroll lock;
- backdrop close;
- Escape close;
- focus trap;
- restore focus to the invoking control.

The visual BottomSheet component should be promoted only from the real production/AppNav sheet. Do not fabricate a polished component that is not backed by the actual interaction.

## 12. Record Workspace pattern

Customer, Lead, Job, Estimate, Change Order, and Invoice use the same operating grammar:

1. **Identity header** — record identity, canonical status, compact metadata, capability-aware actions.
2. **Attention region** — only unresolved human action; omit when empty.
3. **Section navigation** — a few stable record sections.
4. **Primary work surface** — the reason the contractor opened the record.
5. **Context rail** — Athena, related records, provenance, or another narrow contextual module.
6. **Activity / relationship trail** — history and relationships below or inside the relevant section.

Rules:

- no giant record hero;
- status is not attention;
- primary work owns the width;
- context disappears/collapses before work gets cramped;
- mobile changes composition rather than shrinking desktop;
- Athena inherits the record context;
- partial query failures stay local.

## 13. Athena behavior contract

Athena is the intelligence layer of TradeOS. Do not make it a generic chatbot.

Athena has three product forms:

1. **Workspace** — full page when the contractor intentionally works with Athena. The canonical desktop Job-scoped Workspace is pinned in Figma and uses selected TradeOS context, contractor-language results, visible context/trust, and plain-language confirmation before writes.
2. **Context panel / sheet** — inside Estimate, Customer, Job, and other workspaces; current-record context is automatic. The canonical mobile Job-scoped contextual sheet is pinned in Figma and uses the same selected-scope/action grammar.
3. **Inline intervention** — small, specific signals such as an assembly match, stale pricing, missing scope, or setup required.

Implementation note: the current `/athena` route is still owner/admin observability. The canonical contractor Workspace is approved design authority, but route ownership must be resolved before implementation so observability and contractor workflows do not collide.

Athena behavior:

- start from rough contractor language;
- inspect TradeOS data before asking follow-up questions;
- use record context, Costbook, labor, materials, assemblies, supplier evidence, and relevant workflow state;
- ask **one necessary clarification at a time**;
- prefer fast constrained choices plus free text;
- never ask the user to restate identity/context already known by the surrounding record;
- surface confidence and provenance when supported;
- make placeholder, unverified, stale, or unavailable pricing explicit;
- never invent unavailable prices;
- preserve estimate pricing snapshots after accepted lines are persisted;
- read/recommend broadly, mutate carefully;
- require the real product confirmation boundary before consequential writes;
- explain what will change before an impactful action;
- fail closed on missing permission, approval, setup, or authority;
- do not narrate “AI thinking” when deterministic product data already provides the answer.

Product-facing copy uses **Athena**. Use “AI” only in technical implementation or audit language when it describes the underlying system, not as a competing feature name.

## 14. Estimate workflow contract

The canonical estimating workflow is:

**Scope → Items → Price → Review**

It is one continuous job.

### Scope

The contractor starts with plain-language work, known conditions, and field facts.

The product should move from a rough two-sentence scope toward a professional estimate without requiring a long form before usefulness appears.

### Athena inside estimating

Athena is contextual, not a separate side quest.

Before asking questions, it checks available TradeOS data. It asks only the missing fact that materially changes scope, price, schedule, or risk.

### Items

**Items are the central production surface.**

Costbook items, Assemblies, custom work, and accepted Athena suggestions all feed the same Estimate Items list. They are not separate workflows the contractor must manually reconcile.

Accepted items persist through the authoritative Estimate Engine path. Preserve source identity and pricing/trust context where the backing data supports it.

### Price

Pricing controls, markup, tax, totals, margin, and pricing trust belong here. Never hide weak source evidence behind a confident total.

### Review

Review speaks customer language: scope, exclusions, totals, readiness, and what will actually be sent.

“Review” is a workflow stage. Do not use generic “Review” as an action-button label when a specific action such as “Review proposal” or “Record payment” is known.

### Mobile

Mobile keeps the same stages and one dominant `StickyTaskAction` above the `ControlDock`.

The canonical mobile frames for **Scope → Items → Price → Review** are pinned in Figma and use the same EST-1048 estimate data as the canonical desktop workspace. Scope includes editable rough scope, Athena interpretation, and one necessary clarification. Items is the central production list. Price preserves editable authoritative totals and pricing trust. Review speaks customer language and ends with Preview proposal + one dominant Send proposal action.

Do not duplicate desktop inspectors on mobile. The small screen gets the current decision; secondary controls become sheets or sections.

## 15. Needs You contract

**Needs You is an exception queue, not a feed and not a list of normal unfinished work.**

Only surface work that requires a real human decision, exception handling, or rule-triggered follow-up.

Examples that belong:

- overdue invoice requiring collection action;
- stale proposal requiring follow-up;
- real schedule conflict requiring resolution;
- real missing/unsafe pricing condition requiring a decision.

Examples that do **not** automatically belong:

- ordinary draft estimate;
- normal sent proposal waiting for the customer;
- not-yet-due invoice;
- project that simply needs the next normal workflow step;
- passive events such as viewed, created, uploaded, or status changed.

Normal resumable progression belongs in the relevant workspace, **Continue Working**, Universal Create, CRM, or Money.

Use `AttentionItem`.

When several sources produce exceptions, rank across record types by consequence/urgency rather than rendering independent mini-lists.

Use action-specific copy such as:

- Record payment
- Review proposal
- Resolve conflict
- Fix missing price
- Reply

Avoid generic “Review” links when the real action is known.

## 16. Field Workspace contract

The mobile Job / Field Workspace should immediately answer:

- What job am I on?
- What needs done now?
- What should I do next?
- What is blocked?
- What information do I need?
- What has been completed?
- What must be documented before I leave?

This is not a project analytics dashboard.

Rules:

- compact job/customer/location/status identity;
- one state-aware dominant field action;
- use real persisted task/job data for checklists/work plans;
- expose blockers through a real resolution path when that capability exists;
- make closeout requirements explicit;
- do not show fake upload, issue, change-order, messaging, offline, inventory, or other controls before their persistence/permission contracts exist.

Canonical Figma now pins the desktop Job Record Workspace plus the mobile field lifecycle: **Dispatched → Traveling → On site → Completed**, with **On site → Paused → On site** as the supported pause/resume side branch. Paused work must resume to On site before completion. Completed ends field execution without inventing invoice creation; ready-for-invoice remains a separate office/manager acknowledgment.

## 17. Today / contractor command center

Today is the owner command surface, not a widget collection.

The operating rhythm remains:

**Now / Needs You / Coming Up / Money**

It should answer:

1. What should I do now?
2. What genuinely needs my decision?
3. What is coming up?
4. What money needs attention?

Do not regrow a card wall below the command surface.

Needs You follows the exception-queue contract above. Continue Working handles normal progression. Money uses canonical invoice/payment truth.

## 18. Pricing and trust

Contractors must be able to understand where important numbers came from.

Use `PricingProvenance` where source trust affects a decision.

Key rules:

- documented means traceable, not automatically current/local/correct;
- stale is a recency warning layered on provenance;
- unverified and placeholder data must not look like trusted precision;
- unavailable supplier observations remain unavailable — never render them as a numeric price;
- persisted estimate prices are snapshots and must not silently drift when Costbook changes later.

## 19. Shared state taxonomy

Design state is part of the product contract.

Shared state types include:

- loading;
- empty;
- filtered empty;
- partial / degraded;
- restricted / permission;
- not found;
- mutation failure / recovery;
- trust / unknown.

Rules:

- keep healthy data usable when one source fails;
- disclose what could not load;
- never convert unknown into zero;
- never convert missing permission into “no data”;
- use `EmptyState` only for genuine absence;
- preserve user work on recoverable mutation failure;
- show what happened, whether the user’s work is safe, and what to do next;
- optimistic UI must reconcile to backend truth before success is shown.

## 20. Product language contract

Use one noun for one product concept.

### Athena

Product-facing intelligence name. “AI” is implementation language unless a technical surface specifically requires it.

### Schedule Visit

The action that schedules a future visit.

### Site Visit

The resulting field/intake record and pre-job lifecycle stage.

### Lead

The contractor-facing pre-job CRM concept. Current implementation may be Project-backed. Do not imply a separate Lead database unless the domain model changes.

### Project

The customer work container / pre-job-to-job business context.

### Job

The executable field-work record with schedule, assignment, lifecycle actions, and completion state.

Do not use Project and Job interchangeably.

### Needs You

Unresolved human action / exception only.

### Continue Working

Normal resumable progression such as a draft estimate or next workflow step.

### Partially Paid

Human-facing invoice status for the partial-payment state. Do not shorten invoice UI to “Partial.”

### Ready to Estimate

Canonical human-facing Lead state wording.

### Estimate stages

**Scope → Items → Price → Review**

Use this sequence consistently.

## 21. Canonical screen status labels

Frames in product pages use explicit authority labels:

- **`[CANONICAL]`** — approved visual reference;
- **`[TARGET]`** — intended UX that is not current/shipped capability;
- **`[CERTIFICATION]`** — implementation/certification evidence;
- **`[AUDIT]`** — production-gap analysis;
- **`[STATUS]`** — page status/reference material, not an approved production screen.

Do not implement from an `[AUDIT]`, `[TARGET]`, `[CERTIFICATION]`, or `[STATUS]` frame as though it were the current approved UI without reconciling the product contract and page status.

## 22. Current screen authority snapshot

As of 2026-09-27:

### Canonical visual references

- Today desktop/mobile command center using Now → Needs You → Coming Up → Money;
- Customer desktop/mobile;
- Lead / Site Visit UX;
- CRM desktop/mobile overview with Project-backed leads, persisted Project Task follow-ups, and a derived pipeline over Project/Site Visit/Estimate/Proposal state;
- Estimate desktop plus mobile Scope → Items → Price → Review;
- Job desktop Record Workspace plus mobile Dispatched / Traveling / On site / Paused / Completed field states;
- Change Order desktop/mobile;
- Invoice desktop/mobile;
- Costbook desktop/mobile;
- Assemblies desktop/mobile;
- Schedule desktop Day plus mobile Today views, with Day / Week / Crew defined as views over real Jobs + Assignments and a real unscheduled-work tray;
- Athena contractor Workspace desktop plus Job-scoped mobile contextual sheet;
- current document-focused Customer Portal desktop/mobile;
- Settings desktop/mobile.

### Implementation-boundary notes

The current priority-set product screens are now pinned as canonical visual references. Remaining gaps are implementation/capability boundaries rather than missing core visuals.

Athena design is canonical, but implementation still requires a deliberate route decision because the current `/athena` route is owner/admin observability.

### Target-only

- Expense until first-party Expense persistence/domain exists;
- Onboarding until dedicated onboarding state/persistence/skip-resume/handoff exists;
- Customer Portal expansions that require public mutation/read contracts not currently shipped.

This section records design authority, not implementation status. `docs/CURRENT_STATE.md` remains the implementation-status source of truth.

## 23. Brand assets inside product

Use the approved September 2026 TradeOS artwork represented in the Figma Foundations page.

Rules:

- use the correct light/dark artwork for the surface;
- do not stretch or recolor supplied brand artwork;
- keep required clear space;
- use the horizontal lockup at appropriate product sizes;
- use the standalone/simplified mark at smaller sizes;
- do not invent a replacement logo treatment inside product UI.

Marketing tagline/campaign language belongs on marketing surfaces, not as filler inside operational workflows.

## 24. Accessibility

Every product screen must account for:

- accessible contrast;
- visible focus states;
- keyboard navigation where applicable;
- practical mobile touch targets;
- focus trap and focus restoration for sheets/dialogs;
- reduced-motion support;
- readable type sizes;
- semantic state not communicated by color alone;
- accessible loading/status announcements where production patterns require them;
- clear error and recovery messaging.

Production accessibility fixes and current token pairings are authoritative for exact implementation values.

## 25. Content and voice

Prefer direct operational language.

Good:

- “2 things need you”
- “Invoice is 8 days overdue”
- “Record payment”
- “Review proposal”
- “Ready to Estimate”
- “Use in Estimate”

Avoid:

- generic “Review” when the action is known;
- vague AI claims;
- marketing slogans inside workflow screens;
- corporate jargon;
- cute copy around money, scheduling, risk, or failure;
- assertions unsupported by current product data.

## 26. Anti-patterns — do not ship

Do not ship:

- walls of equal-weight cards;
- rainbow record/section colors;
- gradients everywhere;
- glassmorphism as the default product surface;
- excessive pills;
- decorative charts above urgent work;
- fake data presented as live;
- dead buttons;
- unsupported integrations or actions presented as usable;
- blank operational screens;
- generic chatbot styling for Athena;
- Forge marketing styling across normal product workflows;
- modal-on-modal stacks;
- desktop geometry squeezed onto mobile;
- multiple equally dominant CTAs;
- new one-off components when a canonical primitive/pattern already exists;
- a polished target mockup that silently implies unsupported capability.

## 27. Design → production gate

A screen is not done because it looks good. It is ready when capability, design, states, and implementation agree.

Before calling a screen implementation-ready, verify:

### Contract

- capability, routes, mutations, lifecycle, permissions, and persistence are real;
- current Figma page status is known;
- unsupported actions are removed or visibly target-only;
- terminology matches the product/domain contract;
- data authority is known;
- telemetry or engagement is not invented.

### Experience

- desktop/mobile composition is intentional;
- loading is designed;
- empty state moves work forward;
- errors preserve confidence and user work where possible;
- partial failures stay local;
- trust/unknown state remains visible;
- one dominant task action exists where appropriate;
- accessibility behavior is specified.

### Handoff

- canonical components/tokens are reused;
- Record Workspace / Field / Estimate / Needs You / Responsive Shell patterns are followed;
- state mapping is explicit;
- data dependencies and unavailable-state behavior are named;
- acceptance criteria are observable;
- implementation gaps are explicitly tracked instead of leaking into “finished” UI.

## 28. Agent/frontend implementation contract

When changing TradeOS product UI:

1. Read this file.
2. Read the relevant capability/domain source-of-truth documents.
3. Check the relevant canonical Figma page and its `[CANONICAL]` / `[TARGET]` / `[AUDIT]` / `[CERTIFICATION]` / `[STATUS]` status.
4. Inspect current production components/tokens and `docs/ui-guide.md`.
5. Reuse or converge existing primitives before creating another component.
6. Keep page files thin and follow current frontend data-access patterns.
7. Do not invent backend behavior, permissions, prices, telemetry, or lifecycle to make a design “work.”
8. Test at 390 / 768 / 1024 / 1440 where the surface is responsive.
9. Verify loading, empty, error, partial/degraded, permission, and trust/unknown states as applicable.
10. If capability truth changes, update the governed capability documentation and implementation together.
11. If the permanent design system changes, reconcile the canonical Figma and this contract in the same design pass.

The target is a TradeOS experience that feels **simple on the surface, intelligent underneath, and unmistakably built for contractors**.
