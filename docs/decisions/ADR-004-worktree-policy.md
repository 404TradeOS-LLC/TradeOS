---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - AGENTS.md
  - docs/agent-prompts/DOCS_WORKTREE_CONTRACT.md
---

# ADR-004 Worktree Policy

## Status

Accepted

## Context

Concurrent workers need isolation without long-lived branch sprawl or accidental interference with the primary checkout.

## Decision

Use one clean main worktree plus one linked worktree per active concurrent worker. Keep branches short-lived, never implement directly on main, and remove linked worktrees after merge and verification.

## Consequences

- concurrent work stays isolated
- recovery worktrees stay temporary
- cleanup must use Git worktree commands instead of destructive filesystem removal
- the operational step-by-step lifecycle is documented in `docs/REPOSITORY_GOVERNANCE.md`

## Alternatives considered

- permanent per-module branches
- shared edits in the primary checkout
- manual linked-worktree deletion with `rm -rf`
