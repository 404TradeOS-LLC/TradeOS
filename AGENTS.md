# AGENTS.md — TradeOS Autonomous Engineering Contract

Repository-specific operating contract for AI agents and automated maintenance work in TradeOS.

## Authority and source-of-truth hierarchy

This file defines agent behavior. It does not replace the repository's canonical product, sprint, or governance sources.

Read and obey, in order:

1. `docs/TRADEOS_BIBLE.md` — doctrine and source-of-truth hierarchy.
2. `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` — canonical startup and completion flows.
3. `docs/REPOSITORY_GOVERNANCE.md` — branch, worktree, PR-readiness, review, merge, and cleanup policy.
4. `docs/SPRINT_BACKLOG.md` — executable sprint state.
5. `docs/SESSION_HANDOFF.md` — immediate continuity.
6. Relevant module docs, accepted ADRs, and ownership documents for the paths being changed.

`docs/README.md` is the documentation index, not a competing execution flow.

If these sources conflict, stop and resolve the higher-authority source rather than inventing a compromise.

## Mission model

TradeOS agents are expected to **complete bounded engineering work**, not merely report on it.

For an actionable, low-risk defect or maintenance task, the default loop is:

**inspect → reproduce/validate → root-cause → repair → test → inspect diff → commit → PR → verify CI/review → merge when permitted → verify landed state → clean up**

Do not stop at a report when the repository, permissions, evidence, and risk level permit a safe repair.

At the same time, autonomy is not permission to expand scope. Prefer the smallest root-cause fix that restores an established contract.

## Current posture

TradeOS is in RC1 hardening. Priorities are:

1. production correctness and tenant isolation;
2. broken builds, deployments, CI, and regressions;
3. user-visible defects and incomplete production workflows;
4. security and data-integrity defects;
5. test gaps around validated defects;
6. documentation drift tied to implemented behavior;
7. bounded maintainability fixes required to complete the above.

Do not redesign working systems, perform cosmetic architecture migrations, or introduce speculative abstractions during maintenance work.

## Repository boundary

This is the canonical TradeOS product monorepo.

Primary deployables:

- `app/` — Express/TypeScript API
- `web/` — Next.js 16 frontend

First-party capabilities remain in this repository unless an explicit architecture decision establishes another boundary. Do not create separate repositories or peer top-level branded source trees merely to isolate Athena, Costbook, Estimator, Dispatcher, Field Tech, Office Manager, CRM, or other TradeOS capabilities.

Focused agent workstreams are execution boundaries, not repository boundaries. Work from the repository root and consider cross-monorepo test and dependency impact.

## Mandatory startup checks

Before changing code, follow the canonical startup flow and additionally establish:

- exact repository and default branch;
- current `main`/base SHA and remote state;
- current branch/worktree and whether it is clean;
- bounded mission and acceptance criteria;
- allowed paths and forbidden paths;
- relevant owner documents from `docs/DOC_OWNERSHIP.yml`;
- overlapping open PRs, branches, or active work that could conflict;
- validation commands required for the touched surfaces;
- whether the task falls into an autonomous, PR-only, or prohibited category below.

If another PR already implements the same fix, verify and advance that work instead of creating a competing implementation.

Stop on unexpected branch movement, unexplained dirty state, ambiguous ownership, or overlapping edits that make the bounded mission unsafe.

## Autonomous action policy

### May repair and advance autonomously

Agents may implement, test, open/update PRs, and advance toward merge for high-confidence bounded work such as:

- reproducible application bugs;
- CI failures caused by repository code or configuration;
- merge conflicts and stale branches when intent is unambiguous;
- TypeScript, lint, build, or test failures with a clear root cause;
- null/undefined and error-handling defects;
- API contract mismatches with an established intended contract;
- incorrect state transitions with clear existing invariants;
- tenant/org scoping defects whose correct behavior is established by the security model;
- missing regression tests for a validated defect;
- small dependency-direction or module-boundary violations with an established canonical location;
- stale documentation directly contradicted by verified implementation;
- low-risk dependency/configuration repairs that do not change product policy or secret material.

### PR-only / human decision required

Agents may investigate, prepare evidence, tests, migration plans, and a reviewed PR, but must not autonomously merge or execute changes involving:

- new or materially changed database schema or migration behavior;
- destructive or irreversible data operations;
- authentication or authorization policy changes beyond restoring an already-established invariant;
- RLS policy redesign;
- production secrets, credentials, tokens, signing keys, or secret rotation;
- billing, payment processing, pricing, entitlements, or money movement;
- major architecture or repository-boundary changes;
- new external production integrations or changes to trust boundaries;
- broad dependency/framework upgrades with material compatibility risk;
- changes that intentionally weaken tests, CI, branch protection, security controls, or observability;
- ambiguous product behavior requiring a product decision.

For these, stop at the safest reviewable boundary and state the exact decision required.

### Never do autonomously

- bypass branch protection, required checks, or required conversation resolution;
- push directly to `main`;
- use plain force push;
- disable or delete tests merely to make CI green;
- suppress a validated security failure without fixing or explicitly escalating it;
- expose secret values in logs, commits, PR bodies, or reports;
- execute destructive production database commands;
- fabricate test results, approvals, deployment status, or live GitHub state;
- merge a draft PR;
- merge with failing required checks or unresolved review threads;
- silently expand a maintenance task into a redesign.

## Branch, commit, and PR discipline

Repository governance is authoritative. In particular:

- use one short-lived branch per bounded mission;
- use linked worktrees when local execution supports them;
- never develop directly on `main`;
- keep commits focused and reviewable;
- do not mix unrelated cleanup into a repair PR;
- prefer squash merge for normal feature, fix, and documentation PRs;
- use `--force-with-lease` only for a reviewed rebase after verifying the remote head;
- verify the expected head SHA immediately before merge;
- only merged evidence may mark sprint work `DONE`;
- after merge, sync `main`, verify landed content, remove worktrees safely, delete merged branches when appropriate, and prune worktrees.

PR descriptions must accurately state scope, root cause, implementation, validation, limitations, risk, and any follow-up. Do not claim a check was run when it was not.

## Auto-merge readiness contract

An agent may merge a low-risk PR only when **all** of the following are true:

1. the PR is non-draft;
2. scope is bounded and contains no unrelated changes;
3. the final diff has been reviewed against the correct base;
4. required owner documentation is present and meaningful;
5. local validation required for the touched surfaces passed, or the repository explicitly delegates that validation to required CI;
6. the branch is current when required by live repository rules;
7. every required GitHub check is green;
8. required approvals, if any, are satisfied;
9. all review conversations are resolved;
10. no unresolved high-severity security, data-integrity, migration, or production risk remains;
11. the head SHA verified for merge is the SHA that was reviewed and tested;
12. the change is not in a PR-only/human-decision category.

If any condition is uncertain, do not merge.

GitHub rulesets, required checks, approvals, and merge methods are live external state. Verify them directly before relying on them; do not assume dated documentation is current.

## Defect-validation standard

Do not patch symptoms blindly.

Before a bug fix, establish at least one of:

- a failing automated test;
- a reliable reproduction;
- a concrete failing code path supported by logs/CI/runtime evidence;
- a violated invariant demonstrated by code and existing tests/contracts.

Then identify the root cause and add the smallest regression test that would have prevented recurrence when practical.

If evidence disproves the suspected bug, do not manufacture a change. Record the evidence and move to the next validated issue.

## Security model — non-negotiable

Every authenticated backend request depends on all three layers:

1. bearer JWT verification;
2. organization-membership authorization;
3. forced PostgreSQL row-level security inside a scoped database session.

The request-scoped database session sets:

- `app.user_id`
- `app.org_id`
- `app.role`

App-side filtering is defense in depth, not a replacement for RLS.

Treat cross-organization data exposure, authorization bypass, unscoped queries, secret exposure, and RLS regressions as high-priority defects. Do not weaken one security layer because another appears to cover it.

## Database and migrations

Migration source of truth:

- `app/prisma/migrations/`

For new RLS-protected tables:

- use raw SQL in the migration when Prisma cannot express the policy;
- use `FORCE ROW LEVEL SECURITY`;
- parent-owned resources inherit organization scope through joins where appropriate;
- add live integration coverage in `app/tests/rls.integration.ts`.

Mocked Prisma tests do not prove RLS correctness.

Normal deployment is:

```bash
cd app
npm run db:deploy
```

Autonomous maintenance agents must not execute new, destructive, or ambiguous production migrations. Migration changes require the PR-only/human-decision posture unless an explicit approved runbook authorizes the exact operation.

## Module pattern

Business modules normally follow:

```text
app/modules/<name>/
  types.ts
  service.ts
```

Rules:

- services take `orgId` explicitly;
- services do not depend on Express request objects;
- controllers own HTTP concerns and Zod validation;
- preserve organization scoping through every data-access path.

Do not create parallel implementations when an established module already owns the behavior.

## Athena architecture boundary

Athena is TradeOS's shared intelligence and orchestration layer: one assistant gaining capabilities through registered tools, context, routing, and actions. Orchestration remains internal to the user experience.

Canonical reusable package location:

```text
packages/athena/
```

Athena owns foundation concerns such as the AI Kernel, Tool Registry, Context Engine, Router, Action Framework, shared AI interfaces/contracts, capability registration, orchestration policy, and low-risk action policy.

Athena must remain domain-agnostic. It must not absorb Costbook, estimating, dispatch, CRM, customers, projects, field-service, office-management, invoicing, proposal, contract, or supplier business rules.

Domains expose capabilities through explicit contracts/tool registration. Athena core must not depend on concrete domain business implementations. Avoid circular dependencies.

Do not move production code merely to make the tree resemble a target Athena layout. RC1 stability wins over cosmetic architecture work.

## Costbook boundary

Costbook is a TradeOS domain, not a separate repository. Existing Costbook code remains in current application/module boundaries during RC1 hardening.

A future reusable package may live at:

```text
packages/costbook/
```

Only create that package when implementation evidence demonstrates a real shared-library boundary. Do not extract for symmetry with Athena.

## Frontend patterns

Preferred data paths:

- server components/actions: `web/src/lib/api.ts`;
- interactive client components: `web/src/lib/clientApi.ts` through `web/src/app/api/proxy/[...path]/route.ts`;
- binary documents: `web/src/app/api/documents/[...path]/route.ts`.

Prefer server components unless interactivity requires a client component. Keep page files thin. Reuse existing shared/project/proposal/contract/intake component systems. Do not create parallel UI systems for the same workflow.

## Validation matrix

Run the smallest sufficient set during iteration, then the required complete set before declaring readiness.

Backend changes:

```bash
cd app
npm test
npm run test:integration
npm run lint
npm run build
```

Frontend changes:

```bash
cd web
npm test
npm run lint
npm run build
```

Documentation/governance changes:

```bash
npm run docs:check
```

Athena changes must also run the named Athena contract/smoke gates required by current repository CI when applicable.

If a command cannot run because of an external/tooling dependency (for example `psql` required by integration provisioning), distinguish that from an application regression and document the exact blocker. Never convert an unrun check into a pass.

## CI repair policy

When CI fails:

1. inspect the failing job and exact failing command;
2. reproduce locally when practical;
3. classify repository defect vs flaky/external/tooling failure;
4. repair the root cause, not the assertion merely exposing it;
5. rerun the narrow failing test first;
6. run the required broader validation for touched surfaces;
7. inspect the resulting diff before pushing;
8. verify fresh CI on the resulting head SHA.

Do not repeatedly rerun a deterministic failure without changing evidence or code.

## Production repair policy

For production regressions:

1. confirm the failing production behavior or deployment state;
2. correlate logs, request IDs, health status, deployment/build evidence, and recent changes where available;
3. reproduce safely outside production when possible;
4. prefer a code/configuration PR over ad hoc production mutation;
5. add regression coverage;
6. verify the fix through CI and the appropriate post-deploy smoke path.

Existing backend hardening includes centralized error handling, request IDs, structured JSON logging, security headers, a health endpoint, auth/provisioning rate limiting, trust-proxy, and HSTS configuration. See `docs/DEPLOYMENT_GUIDE.md`.

## Documentation ownership

`docs/DOC_OWNERSHIP.yml` is enforced policy. If a changed path triggers an owner document, update that document meaningfully in the same PR.

Do not make cosmetic documentation edits solely to satisfy the checker. If the implementation and owner documentation disagree, determine which source is authoritative before changing either.

## Key files

- `app/backend/server.ts` — Express setup and route mounting
- `app/backend/start.ts` — long-lived backend process entrypoint
- `app/index.ts` — serverless backend entrypoint
- `app/backend/middleware/auth.ts` — JWT and membership resolution
- `app/backend/middleware/databaseSession.ts` — request-scoped DB session
- `app/backend/middleware/errorHandler.ts` — API error mapping
- `app/db/requestSession.ts` — async-local Prisma session routing
- `app/tests/rls.integration.ts` — live RLS verification
- `web/src/lib/api.ts` — server-side backend client
- `web/src/app/api/proxy/[...path]/route.ts` — authenticated browser proxy
- `web/src/app/api/documents/[...path]/route.ts` — binary document proxy

## Release posture gotchas

- RLS is forced; application filters are defense in depth.
- RC1 is a hardening phase, not permission to invent backlog.
- Contractor-visible placeholder or unfinished UX is a release defect.
- Supplier queue/review plumbing exists; live feed ingestion remains a separate implementation question.
- Integration tests require `psql` on `PATH`; provisioning failure can be tooling rather than an app regression.
- The project workspace is the hub; extend existing project-centered flows instead of creating parallel subsystems.

## Completion contract

Before declaring a mission complete:

- run the canonical completion flow;
- inspect the complete diff against the correct base;
- verify no unrelated files were changed;
- run required validation and record exact results;
- update required owner/source-of-truth documentation;
- push and open/update the single bounded PR;
- verify required GitHub checks and review state;
- merge only if the auto-merge readiness contract is satisfied;
- after merge, verify the landed SHA/content and clean up the branch/worktree;
- update `docs/SESSION_HANDOFF.md` when the canonical protocol requires it.

A completion report should distinguish **actions actually taken** from recommendations. State commits/PRs/merges, validation performed, remaining blockers, and the next concrete action. Do not pad the report with generic observations.
