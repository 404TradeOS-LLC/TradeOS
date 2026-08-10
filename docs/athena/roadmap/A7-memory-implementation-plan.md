---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../07-context-engine/README.md
  - ../08-memory/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - ../14-adrs/ADR-005-long-term-memory-model.md
  - A3-context-engine-implementation-plan.md
  - A4-permission-policy-implementation-plan.md
  - A6-action-engine-implementation-plan.md
---

# A7 Memory Implementation Plan

Milestone: A7 — Memory.

A7 establishes a production-quality persistent-memory boundary without enabling autonomous memory writes or business-tool behavior. The implementation is dark by default: no production caller supplies the kernel memory-candidate extractor or memory service write hook.

## Supported behavior

A7 provides:

- `AthenaMemoryService` as the only supported read/write boundary.
- C006 `AthenaMemoryRecord` contracts with source attribution, confidence, retention, status, visibility, actor audit fields, timestamps, and metadata.
- deterministic trusted-source write policy with prohibited secret-shaped content detection.
- Prisma persistence behind `AthenaMemoryRepository`.
- forced-RLS `athena_memories` persistence.
- deterministic stable-key deduplication on `(orgId, scope, subjectId, kind)`.
- correction by supersession rather than destructive overwrite.
- forgetting that clears value/metadata while preserving audit identity/status.
- caller-facing reads that expose only active, unexpired records.
- an actor-scoped, lazy-intent Context Engine memory provider.
- a dormant kernel extension point for future post-action memory candidates.
- reuse of A4 permission evaluation for memory mutations.

## Scope and isolation

The C006 contract recognizes `user`, `organization`, `project`, `job`, and `conversation` scopes. A7 enables only scopes whose authorization is complete at both application and database layers:

- `user`: exact actor only; no admin bypass.
- `conversation`: exact actor only; no admin bypass.
- `organization`: exact organization; mutation additionally requires `settings.manage` and the database admin-capable policy.
- `project`: **recognized but fail-closed in A7**.
- `job`: **recognized but fail-closed in A7**.

Project/job memory previously defaulted to org-wide readability. That posture was rejected during review because org membership is not proof of object-scope authority. Until a complete project/job object-scope resolver exists, the Memory Service returns no project/job records and rejects project/job writes/deletes. The database RLS policy independently makes project/job memory rows unreachable. Enabling either scope requires an explicit later service + RLS change with leakage regression coverage.

This is intentional fail-closed behavior, not a placeholder permission approximation.

## Retrieval invariant

`recall`, `getById`, `search`, and `list` are caller-facing memory APIs. They return only records that are both:

1. `status = active`, and
2. not expired under `retention.expiresAt`.

`getById` therefore cannot be used as an audit-history escape hatch to retrieve corrected or expired values. Audit/history access, if added later, must be a separate explicitly authorized API rather than weakening the normal memory boundary.

## Write policy

A write is ignored when its source is untrusted or its value/metadata contains prohibited secret-shaped content. Existing higher-ranked sources cannot be silently overwritten by lower-ranked sources. Identical values are deduplicated. A permitted replacement creates a new active row and marks the previous row corrected with `supersedes` linkage.

## Forgetting and retention

Forgetting soft-deletes the row and clears `value` and `metadata`, preserving only the minimal audit identity/status fields. Expired memories are excluded from every caller-facing retrieval path. Legal-hold and retention fields remain part of C006; lifecycle enforcement beyond read exclusion remains future retention operations work.

## Context integration

The A7 Context Engine provider reads only the requesting actor's `user` scope. It is `lazy_intent`, confidential, tenant/actor cache-partitioned, optional, and degrading. The router does not yet classify the memory intent, so this provider remains dormant in production.

## Kernel extension point

The kernel accepts optional `memoryCandidateExtractor` and `memoryService` dependencies after a successful A6 action. No production caller supplies them. Memory extraction logic is deliberately absent from A7. A failed optional memory write must never turn a successful business action into a failed action.

## Required security regressions

A7 verification must cover:

- wrong-org isolation;
- wrong-user user/conversation isolation;
- project/job reads returning no data while object scope is unresolved;
- project/job writes and deletes failing closed;
- corrected records unavailable through `getById`;
- expired records unavailable through `getById`;
- untrusted-source rejection;
- prohibited secret-shaped content rejection;
- deletion clearing stored content;
- correction/supersession semantics;
- forced RLS and actor/organization policies;
- dormant kernel write hook by default.

## Deferred work

A7 does not implement semantic/vector retrieval, natural-language memory management, admin memory UI, project/job object-scope enablement, production memory extraction, business tools, events, plugins, or autonomous writes.

## Exit criteria

A7 is complete when memory is source-attributed, deterministic, deletable, correctable, retention-aware, dark by default, and leakage-safe. Unsupported object scopes fail closed rather than broadening authorization. No A1–A6 security boundary is weakened.
