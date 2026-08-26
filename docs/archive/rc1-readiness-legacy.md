---
status: archived
superseded_by: docs/CURRENT_STATE.md
do_not_use_for_implementation: true
---

# TradeOS RC1 Readiness

Last updated: 2026-07-03

## Estimated completion

TradeOS appears to be approximately 82% complete for RC1.

Why this is not lower:

- The repo has a real backend/frontend split with typed TypeScript code, authenticated flows, forced PostgreSQL RLS, migrations, unit tests, and live integration coverage.
- The core contractor workflow is implemented across customer, project, estimate, proposal, contract, invoice, and project workspace surfaces.
- Health checks, centralized API error handling, request validation, auth rate limiting, and migration automation already exist.

Why this is not higher:

- Several user-facing areas still expose intentional placeholders instead of production-complete behavior.
- At least one operational integration is still a stub rather than a live production connector.
- Top-level repository documentation still describes the system as MVP/sprint work instead of an RC-stage commercial product.
- The repo mixes active product code with historical planning, handoff, and archive material in ways that reduce launch clarity.

## Critical blockers

### 1. User-visible placeholder flows remain in production paths

RC1 should not ship with core workflow tabs that explicitly announce unfinished backend ownership or placeholder behavior.

Current examples found in the active app:

- Warranty is still a non-final workflow surface rather than a first-class domain; the project workspace explicitly says warranty claims are not yet backend-owned.
- AI Estimate Assist still exposes a "Photo upload placeholder" panel instead of a completed feature or a removed production affordance.
- Invoice detail still tells the user that payment history and credit memo automation are placeholders for a future sprint.
- Site visits still label GPS capture as a placeholder.
- Contract/portal copy still references IP placeholders rather than production audit language.

Impact:

- These surfaces reduce trust for a contractor evaluating the product as commercial software.
- They create ambiguity about which parts of the lifecycle are actually supported at launch.

Release direction:

- Remove placeholder language from customer-facing UI where the feature will not be complete for RC1.
- Either finish the workflow or downgrade it to a clearly non-primary/internal state before launch.

### 2. Supplier feed ingestion is not production-complete

The supplier queue/review plumbing is implemented, but the actual feed connector is still stubbed and returns no quotes.

Impact:

- This is acceptable as an internal architectural milestone, but not as a production-ready "supplier integration" story unless the product and docs explicitly scope it as manual-review infrastructure only.

Release direction:

- Either complete one real supplier connector for RC1, or relabel the feature everywhere as queued supplier price review infrastructure rather than a live integration.

### 3. Repository and docs still present TradeOS as an MVP/sprint project

The current top-level repo narrative is stale for RC1:

- `README.md` still describes the backend as an MVP and the frontend as a started shell.
- `docs/PROJECT_STATUS.md` is still framed as "Sprint 11 status."
- `docs/NEXT_STEPS.md` still recommends "Sprint 12."
- `docs/SYSTEM_ARCHITECTURE.md` is still narrated around Sprint 11 changes rather than current architecture.
- Multiple docs still describe future placeholders and early-phase scope rather than launch posture.

Impact:

- The repo does not read like a release candidate.
- Internal contributors and external reviewers will get conflicting signals about product maturity.

Release direction:

- Rewrite the top-level docs around release posture, supported flows, known limitations, deployment, and operational readiness.

## Medium blockers

### 1. Production security posture is incomplete at the HTTP boundary

What exists:

- JWT auth
- org-membership checks
- forced database RLS
- centralized error handling
- auth and provisioning rate limiting

What is missing or not evident from the audit:

- security-header middleware such as Helmet or an equivalent explicit header policy
- explicit proxy/trust configuration guidance for production IP-based controls
- structured application logging beyond `console.error`

Impact:

- The app has strong data-layer protections but a lighter-than-ideal production edge posture.

### 2. Health and operations surface is minimal

What exists:

- `/health` endpoint returning `{ "status": "ok" }`

What is missing or not evident:

- readiness/dependency checks
- richer operational diagnostics
- documented runbook expectations for failures, cron behavior, and rollback

Impact:

- Enough for development and basic uptime probes, but thin for production operations.

### 3. Environment configuration is present but still localhost-oriented

What exists:

- `app/.env.example`
- `web/.env.example`

What needs hardening:

- examples still default to localhost endpoints
- no top-level deployment guide yet
- no single source of truth describing required production variables by environment

Impact:

- Setup is possible, but operator confidence and repeatability are lower than they should be for RC1.

### 4. Repo contains active product plus historical/archive material without strong boundaries

Observed sources of drift:

- large planning artifacts under `docs/`
- session/handoff files such as `docs/end-of-session-note.md`, `docs/compressed-session-handoff.md`, and `docs/rolling-todo.md`
- `packages/knowledge-engine/` archive and legacy material
- `.claude/worktrees/` workspace artifacts visible in broad repo searches

Impact:

- Audits and new contributors can mistake historical material for active release-critical code.

Release direction:

- Clarify what is product source, what is archive, and what is internal working material.

### 5. Some dependency footprint should be reviewed before RC1

Dependencies appear mostly justified, but RC1 should explicitly verify:

- `playwright` in `app/` is still needed as a regular dev dependency
- `shadcn` CLI package should remain only if still part of the intended workflow
- optional client dependencies should be checked against actual usage and bundle cost

Impact:

- This is not a release blocker by itself, but dependency hygiene should be part of launch hardening.

## Low-priority cleanup

### 1. Remove or reframe stale sprint language across docs

The codebase has outgrown sprint-stamped architecture/status documentation. This is mostly clarity work, but it matters for release quality.

### 2. Consolidate or archive internal session documents

Files like:

- `docs/rolling-todo.md`
- `docs/end-of-session-note.md`
- `docs/compressed-session-handoff.md`
- `claude.md`

are useful internally, but they should not compete with release-facing documentation.

### 3. Reduce placeholder wording in docs that describe already-known future scope

Some docs are accurate but still written from a planning era. They should either move to archive/planning or be rewritten around supported current behavior and known limitations.

### 4. Tighten audit searches to exclude workspace artifacts

Future audit automation should ignore:

- `.claude/`
- `node_modules/`
- `.next/`
- archive/reference folders that are not part of the running product

This will reduce false positives and make RC readiness scans more trustworthy.

## Technical debt summary

Primary debt themes identified:

- Release-state documentation drift
- User-facing placeholder surfaces left inside active workflows
- One real production integration still stubbed
- Minimal production-edge hardening at the HTTP layer
- Repository organization that mixes shipping product with internal planning/history

Secondary debt themes identified:

- Localhost-heavy environment examples
- Minimal operational diagnostics
- Potential dependency cleanup opportunity

## Current release posture

### Strengths

- Strong backend service/module pattern
- Explicit org scoping and forced RLS
- Real unit and live integration testing strategy
- Working customer-to-project-to-document lifecycle
- Reusable frontend component structure
- Existing migration/deploy scripting foundation

### RC1 risk areas

- Launch polish and trust in unfinished workflow tabs
- Production documentation accuracy
- Operational/deployment clarity
- Security/logging hardening at the app edge

## Recommended order of execution

1. Remove or complete user-facing placeholders in contractor-visible flows.
2. Rewrite release-facing docs so the repo reflects RC1 rather than MVP/sprint status.
3. Add deployment and operations documentation with explicit environment-variable guidance.
4. Harden app-edge production behavior: security headers, structured logging, proxy guidance, graceful failure review.
5. Clarify repo boundaries between shipping code, archives, and internal notes.
6. Perform dependency and performance cleanup after the above launch-critical items are stable.

## Release checklist

### Product readiness

- Confirm the primary contractor lifecycle works end to end: lead/customer -> project -> estimate -> proposal -> contract -> invoice -> closeout.
- Remove or finish all user-visible placeholders in launch-facing routes.
- Verify empty, loading, success, and error states across the primary workflow.
- Confirm terminology is consistent across backend DTOs, UI copy, and docs.

### Repository readiness

- Update `README.md` to describe the current product, not an MVP shell.
- Update `docs/PROJECT_STATUS.md` to a release-state summary.
- Update `docs/NEXT_STEPS.md` to a post-RC roadmap, not sprint planning.
- Update `docs/SYSTEM_ARCHITECTURE.md` to current architecture.
- Add `docs/DEPLOYMENT_GUIDE.md`.

### Production hardening

- Verify all required env vars and document them by environment.
- Add or confirm production security headers.
- Review CORS policy for production deployment expectations.
- Replace or formalize ad hoc console logging.
- Confirm health/readiness behavior.
- Review cron/job behavior and failure reporting.

### Testing and verification

- Run `npm test` in `app/`.
- Run `npm run test:integration` in `app/`.
- Run `npm run lint` in `app/` and `web/`.
- Run `npm run build` in `app/` and `web/`.
- Record any failures as RC blockers, not future nice-to-haves.

### Release management

- Create `CHANGELOG.md`.
- Create `RELEASE_NOTES_RC1.md`.
- Document known issues honestly.
- Define the next milestone after RC1.

## Bottom line

TradeOS is not a prototype anymore. The core product is real.

RC1 is mainly blocked by finish quality:

- a few visible unfinished workflow surfaces
- one stubbed operational integration
- documentation and repository posture that still undersell or misstate the current system

This is a strong base for a release candidate, but it should not be presented as fully launch-ready until those items are resolved.
