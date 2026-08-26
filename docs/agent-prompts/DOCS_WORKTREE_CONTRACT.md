---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: false
related_code:
  - docs
  - .github
  - scripts/docs-check.mjs
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# Docs Worktree Contract

Follow the canonical [startup](NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
and [completion](NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow) flows.
Repository Governance owns the shared branch and worktree lifecycle.

Documentation-specific additions:

- define the allowed documentation or governance paths and forbid runtime,
  schema, dependency, and deployment changes unless the mission says otherwise;
- identify the source-of-truth owner, supporting evidence, required ownership
  updates, and any history that must be preserved before editing;
- do not turn a documentation cleanup into architecture or product change;
- run `npm run docs:test`, the ownership check against the intended base, and
  `git diff --check`; and
- update the Command Center only when operating context materially changes.
