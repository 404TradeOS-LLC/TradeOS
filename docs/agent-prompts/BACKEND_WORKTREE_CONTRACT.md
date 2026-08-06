---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: false
related_code:
  - app
  - docs/modules/auth-and-tenancy.md
  - docs/API_REFERENCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# Backend Worktree Contract

Follow the canonical [startup](NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
and [completion](NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow) flows.
Repository Governance owns the shared branch and worktree lifecycle.

Backend-specific additions:

- define allowed `app/**` paths and every forbidden frontend, package,
  workflow, or infrastructure surface before editing;
- read the owning module docs plus API, RBAC, lifecycle, database, and
  deployment contracts affected by the mission;
- identify migration, RLS, tenant-boundary, permission, and documentation
  impact before changing behavior;
- run backend unit, lint, and build checks, plus live integration coverage when
  the changed risk requires it; and
- do not treat mocked Prisma tests as proof of RLS behavior.
