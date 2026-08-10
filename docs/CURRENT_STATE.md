---
status: current
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_code:
  - app/modules/athena-memory
  - app/prisma/migrations/20260810130000_add_athena_memory/migration.sql
  - app/modules/athena-context-engine/providers/memoryProvider.ts
  - app/modules/athena-kernel/service.ts
  - docs/athena/roadmap/A7-memory-implementation-plan.md
---

# Current State

TradeOS is in RC1 hardening with Project Athena infrastructure progressing sequentially.

## Athena status

Athena A1 through A6 are merged on `main`. A7 Memory is under active review/repair.

A7 introduces the durable `AthenaMemoryService` boundary, source-attributed memory contracts, deterministic write policy, retention/correction/deletion semantics, forced-RLS persistence, a lazy Context Engine provider, and a dormant post-action memory extension point.

Security posture for the repaired A7 branch:

- memory writes remain dark by default; no production caller supplies a memory candidate extractor/write hook
- user and conversation memory are exact-actor scoped with no admin bypass
- organization memory is exact-organization scoped and mutation remains permission/admin gated
- project/job scope values remain contract-recognized but fail closed until complete object-scope authorization exists at both service and RLS layers
- caller-facing `getById`, `recall`, `search`, and `list` expose only active, unexpired memory; corrected/deleted/expired rows are not available through normal memory reads
- corrections preserve audit lineage with `supersedes`; forgetting clears value/metadata
- untrusted sources and prohibited secret-shaped content are rejected by deterministic policy

This A7 work does not add business-specific memory behavior, business tools, autonomous writes, semantic/vector retrieval, or an admin memory-management UI.

## Dashboard status

The owner dashboard uses live operational sources for tasks, dispatch schedule, weather, knowledge coverage, KPI drill-downs, current-week recorded-payment revenue, and the deterministic Owner Briefing. The old disabled AI Assistant placeholder has been replaced without enabling Athena business-tool execution.

## Verification posture

A7 must pass repository unit/lint/build checks, Athena contract/smoke checks, documentation consistency, and live database/RLS integration verification before it can leave draft review status.
