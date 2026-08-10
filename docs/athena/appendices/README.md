---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: false
---

# Athena Appendices

## Glossary

| Term | Definition |
| --- | --- |
| Athena | The AI operating system layer for TradeOS |
| Application service | TradeOS service module that owns business behavior |
| Tool | Registered Athena adapter over an application service capability |
| Context provider | Read-only adapter that contributes facts to AI Context |
| AI Context | Immutable per-request context snapshot |
| Action Engine | Runtime component that enforces approval, idempotency, retries, and execution |
| Memory | Durable, attributed, scoped, correctable, deletable Athena knowledge |
| Event | Versioned record of an important business change |
| Plugin | Future governed third-party extension package |
| RLS | PostgreSQL row-level security, the tenant-isolation floor |

## Assumptions

- Athena starts as a first-party TradeOS platform inside the monorepo.
- Existing TradeOS auth, RBAC, RLS, services, and module docs remain canonical
  implementation truth until changed by reviewed code.
- The current Knowledge Runtime is read-only.
- Current AI Estimate Assist remains review-first and does not autonomously
  write estimate line items.
- External plugin support is future architecture, not a current production
  feature.

## Current-Versus-Future Language

Use "must", "shall", or present-tense architectural statements for binding
Athena doctrine. Use "future", "planned", or "may eventually" for plugin
ecosystem and production runtime capabilities that are not yet implemented.

Do not describe Athena as shipped, enabled, production-ready, or customer-visible
unless [Current State](../../CURRENT_STATE.md) and module docs verify that fact.

## Review Checklist

- Does the change preserve `Athena -> Tool -> Application Service -> Domain Logic -> Infrastructure`?
- Are permissions enforced outside the LLM?
- Are high-risk actions approval-gated?
- Does every tool return the standard result envelope?
- Is memory attributed, scoped, retained, correctable, and deletable?
- Are events versioned and safe to replay?
- Is untrusted content treated as data, not authority?
- Is the claim clearly marked current implementation or future architecture?
