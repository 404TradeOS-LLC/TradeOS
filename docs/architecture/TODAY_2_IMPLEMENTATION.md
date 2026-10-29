# Today 2.0 implementation and verification

2026-10-26 · Sprint ID NONE · branch `feat/today-2-command-center` · base `e17a166`.

The founder's October 26 brief controls the new Today composition. Figma master `xImUa9CYUjx3Cb3zTrkfnY` nodes 295:9, 295:121 and 48:2 were read with screenshots. They retain the older Now/Needs You/Coming Up/Money layout; the new brief removes Money analytics and adds operational coordination. Existing semantic tokens, components, calendar-day rules and authenticated services remain authoritative.

## Implemented

| Surface | Connected behavior |
| --- | --- |
| Today | Authenticated name, role, organization date/time; operational counts; next-action source handoff; no financial analytics |
| Needs You | Dedicated route; priority/source/assignee filters and search; blocked/overdue tasks, overdue jobs, stale proposals, overdue invoices, real conflicts and unexpired pending approvals |
| Today’s Work | Daily assigned jobs and manager-visible tasks, filters, schedule timeline and separate upcoming organization-week jobs |
| Mobile | Responsive CSS compositions at mobile/tablet/desktop breakpoints, safe-area dock spacing, native contextual dialog, theme controls |
| Context workspace | Record context, responsible party, due date, source destination and existing canonical mutation/history workspace |
| Control Dock | Today / Dispatch / Create / Work / More at all widths; task creation reuses Project selector → existing Task form |
| Athena | Existing capability-gated AthenaWorkspace and server-policy kernel path with contextual page scope; no direct client-side business writes |
| States | Loading route, permission/access unavailable, filtered empty, source partial/failure, offline status, stale snapshot and manual/periodic refresh |

Queues are derived from persisted exception contracts. Opening an item never dismisses it. Mutations, history and audit remain in canonical record workspaces; refresh re-reads source truth. Unknown/truncated counts render unavailable. Distinct people scheduled are labeled as people rather than fabricated crew groups. Field data reads use assigned Jobs/RLS and omit commercial/organization Task reads.

## Reused architecture

`web/src/lib/api.ts`, `session.ts`, domain `hasPermission`/role normalization, DispatchSummary organization ranges, schedule conflict preview, queue models, `dashboard-task-dates.ts`, `AthenaWorkspace`, `ThemeToggle`, source record routes, existing Control Dock focus/body-scroll handling, universal-create contracts, native Task form.

New files: serializable `today-model.ts`, request-memoized `today-data.ts`, interactive TodayExperience/CSS, access/error state and two dedicated routes. No new backend endpoint, migration, permission, RLS policy, integration trust boundary, financial operation or dependency.

The decorative hero is `web/public/today-construction-hero.webp` (approximately 171 KiB), generated with the built-in image tool and compressed for delivery. Prompt: a wide cinematic editorial photograph of a residential construction site at first light, framed house, workers checking plans, work truck, copper sunrise and graphite shadows, composition concentrated on the right, no text/logos/UI. It is decorative imagery, never claimed as a customer's live site or weather.

## Verification results

- Actual loader/model execution: 15/15 focused tests passed. Transport/session collaborators are synthetic; real domain permission functions, queue adapters and calendar-day helpers execute. Cases include owner/field/anonymous/unsupported role, no forbidden field reads, token never serialized, partial service failure, truncated totals, passive record exclusion, disabled/unavailable Athena, upcoming-day separation and stored UTC-midnight deadlines in Indiana/Tokyo.
- Full frontend suite: **513/513 passed**, zero failures/skips. Full ESLint: **exit 0**. TypeScript: **exit 0**. Production Next.js build: **exit 0**, including the Today, Needs You and Work routes. PR/governance tests: **159/159 passed**. Documentation helper tests: **40/40 passed**. Docs ownership/preflight and diff whitespace: **passed**. These are local code checks, not browser or live-data certification.
- Native browser/responsive/accessibility certification: **blocked/unverified**. Managed `sites-preview` adds `--host`/`--strictPort`, rejected by Next.js. An isolated preview-only adapter was attempted without changing application code; its runtime subprocess fails with ENOENT. Temporary synthetic browser QA route was removed. No screenshot or browser pass is claimed.
- Real database/RLS/integration tests: **not executed locally**; no backend policy changed. Required hosted PostgreSQL integration and exact-head CI remain mandatory. Unit tests are not RLS evidence.
- Production/Sites deployment: **not performed**. Canonical product is Next.js; Sites has a different server runtime. Publishing a disconnected fixture site would not meet this task's production requirement.

## Remaining acceptance gaps

1. Field ProjectTask updates need a verified user assignment contract; current `assignedTo` is free text and technician PATCH lacks `crm.write`. No unsafe role grant or client-only assignment filter was added.
2. Organization-wide crew groups, standalone site visits, meetings, documentation/material exceptions and milestone aggregation require real domain contracts; unsupported categories are disclosed rather than seeded. Upcoming scheduled jobs are supported.
3. Athena contractor confirmation is not connected for restricted actions in the existing workspace. Existing server states/idempotency/error recovery are reused; broader autonomous routine execution requires its supported domain tools and authorization path.
4. Source workspaces own detailed history and mutations. No inline approve/payment/send/resolve button is invented. There is no new customer-follow-up persistence or synthetic resolution.
5. Browser viewport, keyboard, focus, responsive screenshots, live role journeys and full hosted certification remain unverified. Required CI/review/acceptance must pass before merge/release.

This branch is a reviewable production-code implementation, **not a claim that the entire requested product is complete**. Preserve a draft PR while acceptance gaps remain. Rollback is a normal revert of the UI/data-composition commit; no data migration is involved.

## PR #798 review repair and browser continuation

Original reviewed head: `6713c16c1b61a6244cd258eaf846559d2c6817ac`. Verify repository run `40399371633` passed Web unit tests/lint/build/audit and PostgreSQL integration/migration rehearsal on that head. Docs consistency, branch currency, dependency review and governance also passed. This is real hosted integration evidence, distinct from the original local unit checks.

The continuation includes unfinished Jobs from earlier days through a separate bounded, role-scoped overdue read. It filters the server’s overdue flag, excludes terminal/archived/unscheduled records, deduplicates overlaps and makes failed/truncated overdue coverage unknown. Needs You navigation and panel badges now share the nullable total. Manager Job links use canonical filtered Dispatch with encoded Job numbers. Calendar-date tests use a fixed VM clock. Design section 17 is reconciled throughout.

A new hermetic component suite builds the full production TodayExperience, AppNav, command palette, theme and shared controls; only Next routing/auth transport are synthetic. Its 12 authored browser cases cover 390/768/1024/1440 in both themes, context dialogs, source filtering, dock focus, field restrictions, theme persistence and offline recovery. Component bundle/Tailwind compilation passed; the fresh hosted browser run remains required before claiming those tests passed.

CUA browser checks now render those production components in an isolated static test harness. Observed at iframe viewports 390/768/1024/1440: document scroll width equals client width (375/753/1009/1425 with browser scrollbars); no product-page overflow. Verified mobile theme switching, unavailable-count em dashes, all five Create destinations, Escape/focus restoration, native contextual dialog/source link, source filtering and filtered-empty recovery. These are synthetic component checks, **not authenticated live-data journeys or production deployment**. The Next.js runtime preview limitation remains; no auth gate was bypassed.

Fresh continuation checks: **518/518 frontend tests**, including **20/20 Today model/actual-loader tests**, **159/159 governance tests**, full frontend lint/TypeScript/build and docs ownership/whitespace checks pass locally. The continuation code is based on `6713c16c1b61a6244cd258eaf846559d2c6817ac`; its new hosted exact-head and 12 authored browser cases remain pending until CI completes.


## Contextual task-status continuation — October 26, 2026

`EXISTING_WORK_FOUND`: continued PR #798 from `fdcc63cc`, fetched main `f5fac882`, no competing open task/Today implementation. Allowed changes remain Today frontend and verification/docs; backend policy, schema, RLS and financial writes remain excluded. Owner/admin/dispatcher and compatibility estimator task controls derive from existing `crm.write`; field/viewer/unknown roles receive no task-edit controls. The backend remains authoritative.

Structured task/project targets now pass from authenticated task records into both Needs You and Work. The contextual editor PATCHes only status through `clientFetch`/the authenticated proxy to the existing project-task endpoint. The existing server transaction records activity history. No new API or mutation policy is added. A response must confirm the same source task/project and requested status before success is shown. Success refreshes from server source truth; completed-task refresh removes it from both attention and work and reconciles task/attention counts. Failure never locally resolves it.

The editor handles offline, pending, rejected and unconfirmed saves without automatic retry. Pending saves disable controls, source navigation, closing and Escape; a synchronous guard prevents duplicate submission. Errors keep the source workspace available for recovery. The existing endpoint uses last-write-wins updates, with no atomic revision precondition; concurrent task edits are not certified as conflict-safe by this UI work.

Previous head `fdcc63cc` passed hosted run 40427077847 (518 frontend / 20 Chromium component tests and PostgreSQL integration/migration rehearsal). The real Vercel Preview `dpl_6VNMQzwzw8mLdEQkHiv7eJuqJqRh` is READY at https://tradeos-costbook-9vrksg8yo-billykshowalters.vercel.app/login for that head. Dashboard → login was verified; secure sign-in was declined. Earlier unverified-browser/deployment entries above describe historical checkpoints, not the latest evidence. No authenticated live-data mutation is certified.

Current continuation: five new transport/permission/confirmation tests plus an actual-loader refresh regression; six additional authored Chromium interaction cases cover owner/office saves, pending Escape/refresh guards, 403/409/503 rejection and offline recovery. Fresh local verification: frontend 524/524, focused loader/model 21/21, new mutation transport/permission 5/5, governance 159/159 and docs helpers 40/40 passed; frontend lint, TypeScript, production build, docs ownership and diff whitespace passed. The new refresh regression initially used the wrong harness entrypoint, was corrected to its existing `run` seam, and then passed with the complete suite. Hosted exact-head browser/integration results remain pending publication and will be recorded in PR #798. No merge or production-release claim; remaining field, Athena and domain gaps above persist.


## Atomic task revision follow-through

The concurrency limitation in the preceding checkpoint is now addressed for Today callers. Scope expands only to the existing project-task controller/service/types and their tests/docs; auth, policy, schema and financial exclusions remain. The controller accepts optional `expectedUpdatedAt`, validated as a datetime. The service includes it in the database write predicate and maps revision mismatch/race to 409. All updates advance `updatedAt` monotonically within one millisecond. The existing transaction rejects before activity recording. Older callers may omit the guard; Today requires a valid source revision and cannot silently downgrade to an unguarded request.

Four service tests, five controller tests and a real PostgreSQL concurrent-save/tenant/read-only case cover this addition. Backend dependencies cannot install locally in offline mode (npm ENOTCACHED for zod); backend unit/type/build and live integration results must come from the unchanged required hosted CI. A temporary VM check can execute actual service logic with an injected database seam, but is not Prisma/RLS certification. Previous frontend-only head `af569528` passed all 26 hosted Chromium cases (18 Today), artifact 12701119449 in run 40429959951. Fresh exact-head backend and browser verification remains required.


Deployment compatibility: Today uses the new status-only `PATCH /api/v1/projects/:id/tasks/:taskId/status`, which requires exactly status and revision and delegates to the existing audited transaction. An old backend would strip an unknown revision on the generic PATCH; using a distinct guarded route instead returns 404 without performing an unguarded write. There is no client fallback. The generic PATCH also accepts the optional guard for incremental adoption. Frontend-only preview cannot certify this new backend contract until its matching API is deployed to a verified nonproduction target.

## Assigned-job task visibility (Today follow-up, 2026-10-27)

`GET /api/v1/projects/assigned-job-tasks?limit=50` returns open shared tasks
attached to the authenticated user's actively assigned, non-archived, nonterminal
Jobs. The controller derives organization and user identity from authentication;
unknown query keys and limits outside 1–50 are rejected. The service additionally
filters Project and Job tenant ownership and active (not removed or declined)
JobAssignments, under the existing forced RLS session. This projects the same
tasks already exposed by an authorized Job detail read; it grants no writes.

Technician Today uses this endpoint rather than the organization task queue.
Shared tasks appear in Work, with blocked/overdue tasks in Needs You and due-day
counts using stored calendar dates. Free-text `assignedTo` remains display-only,
not personal authorization. Field rows open `/field?job=…`; the existing Field
workspace now displays Job DTO tasks and directs progress reports to Job notes.
Task status edits retain existing office permissions. Results at the 50-row cap
are explicitly partial; a task-source failure leaves job scheduling usable and
task counts unknown. No schema, RLS policy or mutation authority changed.
