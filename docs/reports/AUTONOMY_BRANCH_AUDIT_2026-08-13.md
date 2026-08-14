---
status: current
owner: platform
last_verified: 2026-08-13
source_of_truth: false
---

# Autonomy and Remote Branch Audit — 2026-08-13

Snapshot evidence was collected from `origin/main` at
`d4cdbc3c2df5425c399d5459f52aa8c51a9aaf0e` and live GitHub state. This is a
dated audit record; GitHub remains authoritative after the timestamp.

## Task reconciliation

- Equivalent guardrail work: none found in open/draft PRs, current branches,
  recent merged history, or repository text.
- Historical branch `chore/claude-autonomous-development-routines`: absent
  locally, remotely, and from open/closed PR heads; classified as stale task
  input and not recreated.
- Task classification: `NEW_WORK_REQUIRED`.
- Chosen branch: `chore/autonomy-reconciliation-guardrails` from the starting
  `origin/main` SHA above.

## Open pull requests

| PR | Meaningful diff | Branch/current state | CI and review evidence | Decision |
| --- | --- | --- | --- | --- |
| #183 | 20-file C004 equipment catalog diff | open, non-draft, mergeable, 1 commit behind | Verify repository #660 and Docs #541 passed; CodeRabbit passed; threads resolved | retain; protected migration remains human-decision work |
| #184 | 3-file hierarchy activation-permission diff | open, non-draft, mergeable, current with main | Verify repository #669 and Docs #549 passed; CodeRabbit passed; no threads | retain for human review |
| #191 | 21-file transactional event-persistence diff | open draft, dirty against main, 3 commits behind | CodeRabbit passed; no workflow runs exist for current head | keep and repair separately; do not merge yet |
| #193 | 4-file factual governance-doc reconciliation | open draft, mergeable, current with main | Verify repository #668 and Docs #548 passed; CodeRabbit passed; no threads | retain; distinct from this guardrail objective |

## Duplicate families

| Family | Canonical result | Duplicate resolution |
| --- | --- | --- |
| Transactional event persistence | active canonical draft #191 | #145 and #185-#190 closed; #191 contains two additional commits beyond #190 and the implementation is not on main |
| Production readiness health | merged #178 (`834fb343`) | #174 and #176 closed duplicates |
| CodeRabbit configuration | merged #180 (`bdcc4bd1`) | #164 and #171 closed duplicates |
| Sensitive CODEOWNERS | merged #175 (`38232b19`) | #173 closed duplicate |
| Agent autonomy contract | merged #177 (`25ce0817`) | #170 closed duplicate |

## PR #191 evidence

PR #191 is the canonical recoverable effort, not a merge candidate today. Its
head adds two commits beyond the identical #187-#190 head: a live-concurrency
verification requirement and a docs-test wording repair. Its 21-file
transactional implementation remains absent from `main`. The branch is dirty,
three commits behind, draft, and has no GitHub Actions runs for its current
head. Decision: `KEEP_AND_REPAIR`; rebase/reconcile and obtain fresh protected
App, Web, Docs, Athena, and PostgreSQL integration evidence in that separate
PR before any readiness decision.

## Remote branch classification

### `SAFE_TO_DELETE` (8)

All eight remote heads were revalidated immediately before cleanup. Deletion
was not performed because the local Git remote has no authenticated push
credential and the connected GitHub app does not expose ref deletion. The refs
therefore remain recoverable and are listed for founder cleanup.

- `chore/github-actions-runtime-upgrade` — tip already on `main`.
- `chore/production-migration-reconciliation-workflow` — PR #53 merged; remote tip matches merged PR head.
- `chore/web-frontend-deployment-foundation` — PR #51 merged; remote tip matches merged PR head.
- `feature/dispatcher-workspace-foundation` — PR #50 merged; remote tip matches merged PR head.
- `feature/owner-dashboard` — PR #106 merged; remote tip matches merged PR head.
- `fix/auth-context-production-schema-compat` — PR #52 merged; remote tip matches merged PR head.
- `fix/brand-studio-asset-upload-persistence` — PR #30 merged; remote tip matches merged PR head.
- `tmp/a7-original-base` — no PR and temporary by name; its tree exactly matches landed A6 commit `809b531`.

### `RETAIN` (4)

- `claude/lucid-archimedes-ayn2dr` — active PR #193.
- `feature/costbook-c004-reconciled` — active PR #183.
- `fix/athena-transactional-event-outbox-authoritative` — active PR #191.
- `fix/costbook-hierarchy-activation-permissions` — active PR #184.

### `REQUIRES_REVIEW` (4)

- `docs/engineering-sprint-system` — 101 commits behind and no traceable PR for this exact head.
- `docs/s027-costbook-reconciliation` — contains four post-#147 commits with no PR for this exact head.
- `docs/tradeos-design-system` — 104 unique design-system files and no PR.
- `repair/athena-a7-memory` — 13 commits and no PR for this repair head; landed A7 PR #117 used another branch/head.

Do not delete the review-required branches without founder review of their
unique commits and intended disposition.
