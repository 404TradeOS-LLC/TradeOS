---
status: current
owner: platform
last_verified: 2026-07-14
source_of_truth: false
related_code:
  - docs/README.md
  - docs/DOC_OWNERSHIP.yml
  - scripts/docs-check.mjs
  - .github/workflows/docs-consistency.yml
---

# ADR-005 Documentation Governance

## Status

Accepted

## Context

The repository accumulated planning docs, audits, sprint notes, and setup notes that were easy to confuse with current implementation truth.

## Decision

Adopt a source-of-truth hierarchy with:

- a small canonical document set
- module docs that defer to global docs
- archived historical plans kept under `docs/archive/`
- deterministic CI enforcement tying code paths to required docs

## Consequences

- stale planning artifacts stop competing with live implementation docs
- contributors must update relevant docs in the same branch and PR
- CI can block code changes that skip required documentation

## Alternatives considered

- continuing with best-effort manual updates
- deleting historical planning documents entirely
