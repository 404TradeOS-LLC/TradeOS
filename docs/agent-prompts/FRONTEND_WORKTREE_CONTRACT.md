---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: false
related_code:
  - web
  - docs/modules/projects.md
  - docs/modules/customer-portal.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# Frontend Worktree Contract

Follow the canonical [startup](NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
and [completion](NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow) flows.
Repository Governance owns the shared branch and worktree lifecycle.

Frontend-specific additions:

- define allowed `web/**` paths and every forbidden backend, schema,
  migration, package, workflow, or infrastructure surface before editing;
- read the source-of-truth docs for the affected product and frontend surface;
- identify module, Current State, API, RBAC, lifecycle, accessibility, and
  deployment documentation impact before changing behavior;
- preserve existing server/client and authenticated-proxy boundaries; and
- run frontend unit tests, lint, and build plus focused browser verification
  when the changed risk requires it.
