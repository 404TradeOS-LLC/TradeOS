---
status: current
owner: platform
last_verified: 2026-07-28
source_of_truth: true
related_code:
  - AGENTS.md
  - README.md
  - docs/REPOSITORY_GOVERNANCE.md
  - .github/pull_request_template.md
  - .github/PULL_REQUEST_TEMPLATE/
  - .github/ISSUE_TEMPLATE/
  - .github/labels.yml
  - docs/DOC_OWNERSHIP.yml
  - packages/knowledge-engine/README.md
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - .github/workflows/verify-repository.yml
---

# TradeOS Documentation

This directory is the documentation entry point for implementation truth in TradeOS.

## Authoritative documents

Use these files first:

- `docs/ENGINEERING_COMMAND_CENTER.md` for the current engineering mission, verified priorities, and startup/completion protocol
- `docs/CURRENT_STATE.md` for verified implementation status
- `docs/SESSION_HANDOFF.md` for the latest completed-session context and next exact task
- `docs/PRODUCT_SCOPE.md` for product boundaries and non-goals
- `docs/ARCHITECTURE.md` for repository and tenancy architecture
- `docs/DOMAIN_MODEL.md` for canonical entity definitions and relationships
- `docs/API_REFERENCE.md` for route groups and request conventions
- `docs/RBAC_MATRIX.md` for canonical roles and permission expectations
- `docs/WORKFLOW_LIFECYCLES.md` for status vocabulary and transition rules
- `docs/ROADMAP.md` for future work only
- `docs/REPOSITORY_GOVERNANCE.md` for protected-branch policy, required checks, worktree lifecycle, PR templates, issue templates, and label taxonomy
- `docs/DOC_OWNERSHIP.yml` for required documentation updates by code path

## Current versus archived

Current source-of-truth documents:

- live under `docs/` or `docs/modules/`
- use front matter with `status: current`
- may set `source_of_truth: true` when they are canonical

Historical or superseded documents:

- live under `docs/archive/`
- use front matter with `status: archived`
- are preserved for history only
- must not be used for implementation decisions

If a file is not in the authoritative list above, treat it as supporting material unless it explicitly says otherwise.

## Hierarchy

Global source-of-truth files define shared rules.

- `CURRENT_STATE.md` answers what exists now
- `ENGINEERING_COMMAND_CENTER.md` answers where engineering should start right now
- `SESSION_HANDOFF.md` answers what the last completed session did and what should happen next
- `PRODUCT_SCOPE.md` answers what TradeOS is and is not trying to do
- `ARCHITECTURE.md` answers how the system is structured
- `DOMAIN_MODEL.md` answers what entities mean
- `API_REFERENCE.md` answers how backend surfaces are organized
- `RBAC_MATRIX.md` answers who can do what
- `WORKFLOW_LIFECYCLES.md` answers how statuses move
- `ROADMAP.md` answers what is next
- `REPOSITORY_GOVERNANCE.md` answers how repository work must be isolated, verified, triaged, labeled, reviewed, and merged

Module docs under `docs/modules/` inherit those shared rules and should not redefine them. Module docs should link back to the global file instead of copying role or lifecycle rules.

Decision records under `docs/decisions/` explain durable architectural choices.

Agent templates under `docs/agent-prompts/` define startup, completion, and worktree contracts for concurrent contributors.

## Documentation enforcement

Documentation changes are enforced in the same branch and pull request as relevant code changes.

The enforcement flow is:

1. `scripts/docs-check.mjs` determines the changed files against the PR base.
2. `docs/DOC_OWNERSHIP.yml` maps changed code paths to required docs.
3. The checker fails if the required docs are not also changed.

Run locally with:

```bash
npm run docs:check
```

Run tests for the checker with:

```bash
npm run docs:test
```

## `DOC_OWNERSHIP.yml` format

The file contains `rules` and optional `exemptions`.

Each rule supports:

- `paths`: one or more exact paths or glob patterns
- `requires`: one or more documentation files that must change with matching code
- `explanation`: optional human-readable context

Each exemption supports:

- `paths`: one or more exact paths or glob patterns
- `reason`: required explanation for why doc updates are not required

Rules are additive. If multiple rules match the same code changes, the checker requires the union of all referenced docs.

Rename handling:

- code-path ownership checks apply to both the old and new path for renamed files
- ordinary edits to living docs do not automatically require `docs/README.md`
- `docs/README.md` is reserved for documentation-governance, hierarchy, ownership-rule, checker, PR-template, and docs-workflow changes — enforced mechanically: any change to `docs/DOC_OWNERSHIP.yml` requires `docs/README.md` and `docs/REPOSITORY_GOVERNANCE.md` to also change in the same PR
- controller and middleware files should be listed when they own module-specific validation, permission, throttling, or security behavior; for example, AI estimator controller and rate-limit changes are owned by the AI Estimate Assist documentation set
- package-level data corpora are listed when their content feeds a documented runtime consumer; for example, `packages/knowledge-engine/**` runtime and vendored-content changes are owned by `packages/knowledge-engine/README.md`, which is the package's own canonical entry point rather than a `docs/modules/*.md` file

## Source-of-truth files

- [CURRENT_STATE.md](CURRENT_STATE.md)
- [ENGINEERING_COMMAND_CENTER.md](ENGINEERING_COMMAND_CENTER.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [RBAC_MATRIX.md](RBAC_MATRIX.md)
- [WORKFLOW_LIFECYCLES.md](WORKFLOW_LIFECYCLES.md)
- [ROADMAP.md](ROADMAP.md)
- [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md)
- [DOC_OWNERSHIP.yml](DOC_OWNERSHIP.yml)
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
- [archive/](archive/)
