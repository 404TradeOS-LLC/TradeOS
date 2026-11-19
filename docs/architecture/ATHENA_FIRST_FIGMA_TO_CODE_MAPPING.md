# Athena-first Today: Figma → React mapping (draft)

**Status:** implementation on draft PR [#1009](https://github.com/404TradeOS-LLC/TradeOS/pull/1009). Design frames are **unapproved explorations**, not canonical replacements. Updated November 19, 2026.

## Sources and versions

- Master Figma file: [TradeOS](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY).
- Existing approved mobile reference `295:121` remains unchanged.
- Isolated Athena-first Today design: [mobile 390 `1245:2446`](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1245-2446), [desktop 1440 `1245:2492`](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1245-2492).
- Added editable review states: [mobile 390 `1263:2449`](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1263-2449), [desktop 1440 `1263:2480`](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1263-2480).
- Reusable draft-only Figma note-header component: `1263:2445`, with a TradeOS Button instance.
- React source branch: `feat/athena-first-estimate-handoff-20261118`; re-check the PR head SHA and CI after **every** commit. This document does not certify deployment.

## Evidence-backed mapping matrix

| Figma view/component/variant | React source and relevant props or state | Behavior / provenance contract | Match |
| --- | --- | --- | --- |
| Today mobile / desktop Athena-first `1245:2446` / `1245:2492` | `web/src/components/dashboard/today-experience.tsx` → `TodayExperience` with `AthenaWorkspace compact` | Existing authenticated capability gate; Athena opens before hero, Needs You and operational stats. Not a second assistant service | **Structural partial.** Real Today hero, navigation and spacing still differ; no pixel-fidelity certification |
| Global one-tap Athena header shortcut | `web/src/components/shared/app-nav.tsx` → `AppNav` uses `effectiveAthenaEnabled` and `buildUniversalCreateHref("athena", pathname)` | Capability-gated direct link with current page/project scope, screen-reader label and at least 44px touch target on phone; original five-control dock unchanged | **Source mapped; browser/screenshot acceptance at current PR head pending** |
| Athena conversation composer | `web/src/components/athena/athena-workspace.tsx` → `AthenaWorkspace`, `sendAthenaMessage` in `web/src/lib/athena-client.ts` | Actual authenticated kernel; truthful loading, denial, failure, clarification, telemetry. Page-local turns only; no durable conversation continuation | **Verified source contract**, not deployed UX |
| Review notes mobile / desktop `1263:2449` / `1263:2480` | `AthenaWorkspace` review section, `contractorNotes`, `editNote`, `removeNote`, `prepareEstimate` | Contractor must explicitly choose review. Editable/removable authored notes; preserve full text; reject more than 4,000 characters; never copy Athena replies or unedited starter prompts | **Behavior mapped**, visuals partial: Figma depicts standalone review state while React uses an inline panel |
| Existing TradeOS Button library `102382df57f9840beebb34c247c1c9d6dff763cc` | `web/src/components/ui/button.tsx` → `Button` variants/sizes | Ask, Remove note, Review as estimate, 44px targets where appropriate | **Verified component correspondence** by library description/source; Code Connect publication unverified |
| Existing TradeOS Textarea library `e55538bb107d34c6339ab8da7e2dd15c3e88576e` | `web/src/components/ui/textarea.tsx` → `Textarea` | Editable job notes, focus and validation states. Figma supports State=Default/Focused/Disabled/Error | **Structural mapping**; no live Code Connect proof |
| Reusable Figma note header `1263:2445` | Repeated note header/action composition inside `AthenaWorkspace` | Text label + accessible remove action on each note | **Draft component alignment**; no published Code Connect mapping |
| Needs You row Figma draft `1245:2530` | `web/src/components/dashboard/attention-item.tsx` → `AttentionItem` | Action labels and source record routing remain computed from real records | **Not a direct visual/component match**; retain source implementation |
| Current actor + organization handoff | `web/src/lib/athena-estimate-handoff-auth.ts` and `web/src/lib/athena-estimate-handoff.ts` | Server-derived role and authenticated subject+org; one-tab, five-minute, one-shot, identity-matched draft. Browser values are never authorization | **Mapped security boundary**; browser/tenant acceptance pending |
| Project scope and estimate creation | `web/src/app/(app)/projects/new/page.tsx`, `form.tsx`, `web/src/app/actions/projects.ts` | Consumed once into editable `Project.simpleScope`; authenticated Project and Estimate create actions only after user submits | **Mapped code path**; actual staging persistence and partial-failure recovery unverified |

## Parserless Code Connect artifacts (prepared, NOT published)

Following a direct Figma property inspection on November 19, two published design-system component families now have source-controlled parserless `.figma.ts` templates and a root `figma.config.json`. Their source files are outside `web/` so they do not silently enter the Next.js production build.

- [Button template](../../design/code-connect/Button.figma.ts) maps component node [10:57](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=10-57) to `web/src/components/ui/button.tsx`. All Figma variants Default/Outline/Secondary/Ghost/Destructive/Link map to exact React `variant` values; sizes XS/SM/MD/LG map to `xs`/`sm`/`default`/`lg`, respectively. `Label` maps to the child text.
- [Textarea template](../../design/code-connect/Textarea.figma.ts) maps node [175:17](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=175-17) to `web/src/components/ui/textarea.tsx`. Figma `Text` maps to the placeholder. The Default/Focused/Disabled/Error states are exhaustively enumerated: Focused is a design-only interaction preview rather than an app `autoFocus` side effect; Disabled maps to native `disabled`; Error maps to `aria-invalid="true"`.
- [Configuration and unpublished mapping status](../../design/code-connect/README.md). Figma `get_code_connect_map` for the Athena review mobile frame still returned `{}` after local template authoring, as expected before publication.

**Verification boundary:** GitHub file-readback and static option/property inspection passed. The Figma CLI `connect publish` and template parser have **not** been run, and Figma Code Connect seat/permission is not confirmed. No new Figma library publication, code-to-design canonical acceptance, or deployment is implied. Local draft-only note header, queued action and Control Dock are deliberately **not** assigned production Code Connect templates until exact component/prop semantics are verified.

## State and responsive acceptance matrix

- **390 mobile:** Today Athena visible without first scrolling; keyboard/focus safe; note textarea editable; Remove note accessible and usable; error after over-limit; explicit Review as estimate.
- **768 tablet:** compacts without clipping; existing dock/nav, task actions and keyboard access remain functional.
- **1024 / 1440 desktop:** Athena first, operational data remains visible; page/sidebar and review note panel adapt without artificially inventing financial/AI results.
- **Owner/office with `crm.write`:** review action visible if actor+org identity resolved. Missing settings or role denies handoff UI.
- **Technician / missing permission:** can still ask Athena if kernel enabled, but cannot begin the Project→Estimate action from this panel. Backend independent authorization remains authoritative.
- **Identity changed / org switched:** a draft associated with another authenticated subject+org is rejected and removed; no stale cross-login prefill.
- **Errors:** typed kernel failed/denied/needs-clarification states; disabled capability; browser storage failure; expired/malformed/oversized handoff. No optimistic write or fictitious session memory.

## Tests and required release gates

- Targeted pure tests in `web/src/lib/athena-estimate-handoff.test.ts` cover bounds, edited/removed content, expiration, malformed input, identity/organization mismatch and fail-closed missing identity.
- Static UI/route contracts in `web/src/components/athena/*contract.test.ts` and authenticated-source Today loader tests in `web/src/lib/today-model.test.ts`.
- Synthetic browser scenarios in `tests/components/today-command-center.spec.ts` cover Today at 390/768/1024/1440 in dark/light; these are **not** proof of real authenticated Project→Estimate persistence or device visual fidelity.
- Must record exact-head Web lint/build/unit, App checks, Docs consistency, independent review, unresolved threads and branch currency after repair. Require staging web/API identity, owner+office+field and foreign-tenant negative journeys, complete saved Estimate verification, matching Figma render evidence, and protected approval before merge/release.

## Known gaps

The kernel does not have a durable contractor multi-turn conversation lifecycle behind `conversationId`. It cannot honestly generate complete, provenance-verified estimate items from the review card. The draft depicts chat-first entry and review states but the current production composition has visual differences. No Code Connect file for these draft components has been verified in the repository; do not publish or claim mappings until a matching real component export, Figma key, and prop/variant contract are checked.
