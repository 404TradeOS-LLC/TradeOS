# S031 Completion Evidence — Scheduling Conflict Rules

## Objective

Prevent overlapping active technician work while preserving the existing Jobs
lifecycle, assignment authorization, organization scoping, forced RLS, and
dispatcher route surface.

## Shipped behavior

- Schedule, reschedule, create, and assignment mutation paths serialize the
  conflict read and subsequent write with transaction-scoped PostgreSQL advisory
  locks keyed by organization and technician.
- Conflict intervals remain half-open: a job ending exactly when another starts
  is allowed; genuine overlap returns the existing `409` conflict response.
- Direct service calls reject invalid dates and non-finite, fractional, or
  non-positive estimated durations before persistence.
- Archived jobs and removed/declined assignments remain excluded, and the
  current job remains excluded during rescheduling.
- Owner/admin conflict overrides still require a nonempty reason. No new role,
  status, permission, table, route, migration, provider integration, or route
  optimization behavior was introduced.

## Governance and merge evidence

- Readiness PR #357 merged as `7e1f110146eeb761d0b5fa1ffa6630cdef1acadf`.
- Implementation PR #358 merged as `aa421606968f8a83fe0932ab0010131ea9625940`.
- Final implementation head: `0f5e83b607297db1c2019e7a8078f601f83abda0`.
- Implementation merge timestamp: 2026-08-26T01:57Z (GitHub merge event).
- Completion evidence is reconciled in this document and is being merged through
  a separate documentation PR.

## Verification

Local verification passed:

- focused Jobs/controller/dispatch tests: 83 tests
- full app Jest suite: 218 suites, 1,915 tests
- app lint and build
- root docs/pr tests: 54 tests
- `git diff --check`, documentation ownership check, and PR preflight

GitHub PR #358 verification passed:

- Docs consistency
- Live documentation reconciliation
- Sprint governance
- Dependency review
- PR branch currency
- App typecheck/lint
- App unit tests
- App integration and migration rehearsal
- App build and dependency audit
- Athena contracts and smoke

## Security and tenant/RLS validation

The existing `orgId` predicates, authenticated membership checks, role-gated
override policy, request-scoped transaction setup, and forced-RLS architecture
remain unchanged. Advisory-lock keys are derived from the authenticated
organization and resolved technician identifiers, are deduplicated and acquired
in stable order, and cover the conflict check plus mutation. No client-selected
organization context or raw Prisma bypass was added.

The adversarial review checked cross-tenant access, IDOR, insufficient roles,
forged technician identifiers, malformed dates, boundary intervals, self
exclusion, archived/removed/declined records, missing context, replayed
concurrent scheduling, and rollback behavior. No valid in-scope finding remains.

## Review findings and limitations

Copilot and CodeRabbit reported review-quota exhaustion and produced no code
finding or unresolved thread. The repository's Docker-backed integration lane
passed in GitHub Actions; local Docker was unavailable, so no local integration
run is claimed.

Authenticated production/browser evidence was not required for S031 and is not
claimed. S027 remains independently BLOCKED only on authenticated rendered
Costbook browser evidence and was not mixed into this sprint.

## Final repository truth

After the completion-evidence PR merges, `origin/main` must contain both the
implementation merge and this evidence merge, S031 must be `DONE` in the
canonical backlog, and no open S031 PR may remain. S032, S034, and S037 remain
outside this sprint's implementation scope.
