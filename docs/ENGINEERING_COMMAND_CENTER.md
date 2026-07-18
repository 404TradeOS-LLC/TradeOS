---
status: current
owner: platform
last_verified: 2026-07-28
source_of_truth: true
related_code:
  - AGENTS.md
  - docs/TRADEOS_BIBLE.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# TradeOS Engineering Command Center

## Purpose

This is the concise operating overview for TradeOS engineering. It does not replace the Bible, Current State, Sprint Backlog, Session Handoff, module contracts, ADRs, or research evidence.

Start with:

1. [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
2. [CURRENT_STATE.md](CURRENT_STATE.md)
3. [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
4. [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
5. [agent-prompts/NEXT_SPRINT_PROTOCOL.md](agent-prompts/NEXT_SPRINT_PROTOCOL.md)

## Project identity

- `404 TradeOS` is the parent company and operating context.
- `TradeOS` is the contractor SaaS product in this repository.
- The repository remains named `TradeOScostbook`, while the implemented surface and doctrine cover the broader TradeOS platform.

## Current engineering phase

TradeOS is in `RC1 hardening`.

Verified implementation truth belongs in [CURRENT_STATE.md](CURRENT_STATE.md). Strategic sequencing belongs in [ROADMAP.md](ROADMAP.md). Executable work belongs in [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md).

## Current milestone

The Bible foundation has landed (S001, `DONE`). Sprint execution is open after active overlapping PRs are resolved: select the lowest-numbered eligible `READY` sprint per `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. S003 (solo-maintainer governance calibration) is the current first candidate on `origin/main`.

Completed foundation work includes:

- seven Bible volumes;
- a 50-sprint dependency-ordered backlog;
- a mechanical next-sprint protocol;
- merged Volume 3 engineering expansion from PR #32;
- corrected sprint dependency logic;
- updated handoff and governance integration;
- a separate segmented audit and phased cleanup of the knowledge-engine corpus (Phase A/B landed via PR #33 and #34; Phase C deletion of the confirmed duplicate tree remains gated on founder sign-off).

## Canonical execution rule

The Sprint Backlog is the tactical queue. An agent may begin only when:

- the sprint is `READY`;
- every sprint dependency is `DONE`;
- no overlapping PR or worktree exists;
- required external infrastructure is available;
- no founder decision remains unresolved.

If no sprint is eligible, stop and report the blocker instead of inventing work.

## Active PR coordination

At the last verified handoff:

- PR #30 owns Settings/Brand Studio web and related current-state scope (open — do not duplicate or touch its files from another branch);
- PR #35 owns first-party operational truth alignment with the Bible (open draft while this branch is validated);
- PR #31 (Bible foundation), #32 (Volume 3 expansion, merged into #31's branch), #33 (knowledge-engine Phase A), #34 (knowledge-engine Phase B), #27, #28, and #29 are all merged.

Always verify GitHub before editing. This summary is not a substitute for live PR state.

## Current blockers and risks

- Entry-point READMEs and legacy generator scripts contain stale material, but useful setup, competitive, pricing, and historical evidence must be preserved before archive or removal decisions.
- `packages/knowledge-engine/**` (9,986 files) received its separate segmented audit on 2026-07-16. Phase A documentation/governance guardrails (root README, corrected canonical-path docs, focused `docs/DOC_OWNERSHIP.yml` rules, historical notices on conflicting runtime guidance, a package-scoped `.gitignore`) and Phase B pipeline path-canonicalization (`PATHS.md`, `path-manifest.json`, a marker-validated Python resolver, and a fix for divergent generated-export copies) have both landed via PR #33 and #34. The package still contains a confirmed 4,746-tracked-file self-nested exact-duplicate tree and ~1,400 vendored third-party skill directories with incomplete license coverage; both are documented but intentionally untouched pending founder-approved Phase C migration work — do not begin archive or deletion in this package without that approval.
- Ruleset and branch-protection facts must be verified directly in GitHub before being stated as current.

## Required verification

Expected CI jobs include:

- `Docs consistency`;
- `App lint, unit tests, and build`;
- `App integration tests`;
- `Web lint and build`.

Documentation foundation work must run:

```bash
npm run docs:test
npm run docs:check -- --base origin/main
git diff --check
```

The exact required-check configuration remains live GitHub state.

PR templates must capture startup verification, scope, documentation impact, risk review, and exact final status. Issue templates must capture area, priority, owner path, verification expectations, and stop conditions before work starts. Labels must follow the taxonomy in `.github/labels.yml`. See [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md) for the full policy.

## Session startup

Every agent must:

1. verify repository path, worktree, branch, upstream, and clean state;
2. fetch origin;
3. read the Bible, Current State, Sprint Backlog, Session Handoff, and Next Sprint Protocol;
4. inspect open PRs, recent merges, and worktree overlap;
5. state mission, allowed paths, forbidden paths, validation, and stop conditions.

## Session completion

Every agent must:

1. inspect the complete diff against the correct base;
2. run required validation;
3. update affected source-of-truth owners;
4. update sprint evidence only when justified;
5. replace the session handoff with concise current truth;
6. confirm no unrelated changes;
7. commit and push intentionally;
8. open or update one PR;
9. report the exact next safe action.

## Next engineer starts here

Read [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md), [SESSION_HANDOFF.md](SESSION_HANDOFF.md), and [agent-prompts/NEXT_SPRINT_PROTOCOL.md](agent-prompts/NEXT_SPRINT_PROTOCOL.md). If PR #35 is still open, finish that review/merge decision before selecting new work. Otherwise select the lowest-numbered eligible `READY` sprint from [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md). Do not begin archive, deletion, README consolidation, or ruleset mutation outside a sprint's stated scope, and do not begin Phase C of the knowledge-engine cleanup without explicit founder sign-off.

## Source-of-truth links

- [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
- [CURRENT_STATE.md](CURRENT_STATE.md)
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [RBAC_MATRIX.md](RBAC_MATRIX.md)
- [WORKFLOW_LIFECYCLES.md](WORKFLOW_LIFECYCLES.md)
- [ROADMAP.md](ROADMAP.md)
- [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
- [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [DOC_OWNERSHIP.yml](DOC_OWNERSHIP.yml)
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
