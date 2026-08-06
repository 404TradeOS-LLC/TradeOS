---
status: current
owner: platform
last_verified: 2026-08-06
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
  - .github/workflows/reconcile-production-migration.yml
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

The Bible foundation has landed (S001, `DONE`). S003 (solo-maintainer
governance calibration) is complete: PR #73 merged on 2026-08-04 as
`9b3ebb24233cd69d5961d3c1f3c1ea6d017e15ef`. S004 (session handoff
normalization) is complete: PR #80 merged on 2026-08-06 as
`f8179c739cdb7691de2cb3d776f9e7c5da34084f`. PR #81 recorded its completion
evidence and merged as `5efa9835`. PR #82 promoted S005 and merged as
`36a87bea`; a pre-implementation audit then found its readiness record omitted
explicit forbidden paths and named tests. PR #83 repaired those gates and
merged as `ee5000b4`. S005 is complete: PR #84 merged on 2026-08-06 as
`7d1c48376861468122347e19c41f0a007d7b5fc9`. No later sprint has been
promoted.

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

Live GitHub and worktree state verified on 2026-08-06 after S005 merged:

- no pull requests were open before the S005 completion-evidence branch was
  published;
- draft PR #85 is now the sole open pull request and contains only the four
  governance owner documents required to record S005 completion;
- PR #84 merged as `7d1c4837`, completing S005;
- PR #83 merged as `ee5000b4`, completing the missing S005 readiness gates;
- PR #82 merged as `36a87bea`, publishing the original S005 readiness record;
- PR #81 merged as `5efa9835`, recording S004 completion evidence;
- PR #80 was merged as `f8179c73`, completing the S004 implementation;
- PR #75 was merged as `ed013c5b`, making S004 explicitly `READY` before its
  isolated implementation branch was created;
- every dependency pull request from the prior readiness audit is now merged,
  closed, or superseded, so no dependency PR overlaps S004's docs/docs-test
  scope;
- PR #77 was merged as `0afc6f91` after its Next.js 16.3 build repair;
- PR #79 was merged as `42a614e3` for the canonical Loki backend hardening;
- PR #74 was merged as `573e8d61`;
- PR #73 was merged as `9b3ebb24`;
- PR #49 was closed unmerged and Qodana was deferred;
- PR #51 was merged as `cdadd24d`;
- PR #64 was closed unmerged as obsolete;
- PR #30 was merged as `2d80214a`; and
- PR #35 was merged as `c7b84643`.

The remaining security-hardening worktree has three uncommitted
`packages/knowledge-engine/**` edits and does not overlap this governance-only
completion record.

Always verify GitHub before editing. This summary is not a substitute for live PR state.

## Current blockers and risks

- Entry-point READMEs and legacy generator scripts contain stale material, but useful setup, competitive, pricing, and historical evidence must be preserved before archive or removal decisions.
- `packages/knowledge-engine/**` (9,986 files) received its separate segmented audit on 2026-07-16. Phase A documentation/governance guardrails (root README, corrected canonical-path docs, focused `docs/DOC_OWNERSHIP.yml` rules, historical notices on conflicting runtime guidance, a package-scoped `.gitignore`) and Phase B pipeline path-canonicalization (`PATHS.md`, `path-manifest.json`, a marker-validated Python resolver, and a fix for divergent generated-export copies) have both landed via PR #33 and #34. The package still contains a confirmed 4,746-tracked-file self-nested exact-duplicate tree and ~1,400 vendored third-party skill directories with incomplete license coverage; both are documented but intentionally untouched pending founder-approved Phase C migration work — do not begin archive or deletion in this package without that approval.
- The live default-branch rulesets were verified read-only for S003 on
  2026-08-04. Their IDs and exact observed controls are recorded in
  [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md); external state must be
  rechecked before later claims or changes.
- Production migration changes remain manual and `production` Environment-gated. Reconciliation records existing schema state in Prisma history; it must not be confused with executing a normal migration deployment.
- Settings/Brand Studio asset persistence must keep the `project-files` bucket private and all service-role access server-only. Metadata writes are restricted to the authenticated organization's generated `organizations/<orgId>/brand-assets/<assetKey>-<uuid>` namespace, passive raster formats up to 6 MB, and the four supported asset slots; reads must stay behind the authenticated same-org proxy.

## Required verification

Expected CI jobs include:

- `Docs consistency`;
- `App lint, unit tests, and build`;
- `App integration tests`;
- `Web lint and build` (includes frontend unit tests before lint and build).

Documentation foundation work must run:

```bash
npm run docs:test
npm run docs:check -- --base origin/main
git diff --check
```

The exact required-check configuration remains live GitHub state.

PR templates must capture startup verification, scope, documentation impact, risk review, and exact final status. Issue templates must capture area, priority, owner path, verification expectations, and stop conditions before work starts. Labels must follow the taxonomy in `.github/labels.yml`. See [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md) for the full policy.

## Session execution

The sole executable session contract is
`docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`: use its
[Canonical Startup Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
before editing and its
[Canonical Completion Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow)
before handoff. This Command Center reports current operating context and does
not restate those flows.

## Next engineer starts here

Read [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md),
[SESSION_HANDOFF.md](SESSION_HANDOFF.md), and
[agent-prompts/NEXT_SPRINT_PROTOCOL.md](agent-prompts/NEXT_SPRINT_PROTOCOL.md).
No sprint is currently `READY`. Verify live state, then stop without promoting
S006 or beginning archive, deletion, unrelated README consolidation, ruleset
mutation, or Phase C of the knowledge-engine cleanup.

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
