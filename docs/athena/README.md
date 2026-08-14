---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: true
related_docs:
  - ../TRADEOS_BIBLE.md
  - ../ARCHITECTURE.md
  - ../RBAC_MATRIX.md
  - ../modules/ai-estimate-assist.md
  - ../modules/activity-and-intelligence.md
  - ../../app/modules/knowledge-runtime/README.md
---

# Athena Platform Bible

Athena is the AI operating system for TradeOS: one assistant that dynamically
adopts the capabilities needed to help contractors sell, schedule, execute,
invoice, and retain work without making users re-enter information the business
already knows.

This Bible is the durable source of truth for Athena platform doctrine,
contracts, runtime design, safety rules, roadmap, and contribution standards. It
does not claim that Athena is fully implemented. Current implementation truth
still belongs to [Current State](../CURRENT_STATE.md), current TradeOS doctrine
still begins at [TradeOS Bible](../TRADEOS_BIBLE.md), and detailed module truth
still belongs in [modules](../modules/).

As of Friday, August 14, 2026, current Athena core implementation still lives in
`app/modules/**`, with the HTTP entrypoint in
`app/backend/controllers/athena.controller.ts`. `packages/athena/` remains the
canonical future ownership boundary per repository governance and ADR-005; it is
not the current source layout.

PR #202 is the current production-readiness slice on top of the merged Athena
foundation. It adds durable approval and audit persistence, operator approval
routes/UI, resource-aware permission context, and additional first-party context
providers. Those capabilities remain subject to the existing Athena feature
flags and deployment controls; repository merge state does not by itself mean
Athena is enabled in production.

## Binding Decisions

1. Athena is one assistant that dynamically adopts different capabilities.
2. Athena may automatically perform low-risk actions when policy permits.
3. High-risk or consequential actions require explicit approval.
4. Athena remembers user and organization preferences long-term with
   administrative retention and deletion controls.
5. Internal planning, routing, orchestration, tool selection, and subagents stay
   invisible to users.
6. Third-party developers may eventually register tools through a governed
   Athena plugin and tool registry.
7. Athena is proactive: it surfaces risks, opportunities, and recommended
   actions without waiting for explicit questions.
8. Business logic must never live inside the LLM.
9. Athena must never access the database directly.
10. Athena operates only through stable tools, application services, domain
    logic, and infrastructure.
11. Important business changes emit events.
12. Every major action is auditable, permission-aware, and observable.

## Architecture Rule

All business execution follows this boundary:

```text
Athena -> Tool -> Application Service -> Domain Logic -> Infrastructure
```

The LLM must not directly query the database, mutate records, bypass
authorization, call infrastructure internals, infer hidden permissions, or
replace service-owned lifecycle rules.

## Volume Index

- [Summary](SUMMARY.md)
- [Roadmap](roadmap.md)
- [01 Vision](01-vision/README.md)
- [02 Product](02-product/README.md)
- [03 User Journeys](03-user-journeys/README.md)
- [04 System Architecture](04-system-architecture/README.md)
- [05 Runtime](05-runtime/README.md)
- [06 Tool Registry](06-tool-registry/README.md)
- [07 Context Engine](07-context-engine/README.md)
- [08 Memory](08-memory/README.md)
- [09 Security](09-security/README.md)
- [10 Events](10-events/README.md)
- [11 Plugin SDK](11-plugin-sdk/README.md)
- [12 Testing](12-testing/README.md)
- [13 Deployment](13-deployment/README.md)
- [14 ADRs](14-adrs/README.md)
- [15 Contributor Guide](15-contributor-guide/README.md)
- [Contracts](contracts/README.md)
- [Diagrams](diagrams/README.md)
- [Examples](examples/README.md)
- [Appendices](appendices/README.md)

## Relationship To Existing TradeOS AI

Athena extends existing TradeOS seams rather than replacing them:

- AI Estimate Assist remains review-first and routes accepted estimate changes
  through the existing Estimate Engine.
- Knowledge Runtime remains read-only and does not mutate Prisma, Supabase, or
  Knowledge Engine source files.
- Activity and Intelligence primitives remain the natural home for events,
  notifications, recents, saved views, and search-oriented context.
- Auth, organization membership, permission checks, and forced RLS remain
  outside the LLM and outside Athena prompt text.

If this Bible conflicts with verified implementation truth, stop and identify
the owning source-of-truth layer before editing. Do not silently duplicate or
override TradeOS canonical docs.
