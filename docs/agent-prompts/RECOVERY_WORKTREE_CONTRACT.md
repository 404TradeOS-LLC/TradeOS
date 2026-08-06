---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: false
related_code:
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# Recovery Worktree Contract

Follow the canonical [startup](NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
and [completion](NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow) flows.
Repository Governance owns creation, preservation, and removal of worktrees.

Recovery-specific additions:

- use a recovery worktree only to inspect a blocked branch, verify or replay a
  fix safely, or recover from a branch/worktree mismatch;
- define the exact recovery boundary and explicit exclusions before acting;
- do not broaden recovery into feature delivery without a new mission;
- stop if recovery would overwrite unowned changes or require destructive Git
  operations; and
- hand back a verified branch state, or preserve it with an explicit reason,
  before governed cleanup.
