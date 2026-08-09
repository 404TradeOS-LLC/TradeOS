---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Athena Implementation Roadmap

This roadmap is dependency-ordered from architecture to production. It is not a
claim that the milestones are complete.

| Milestone | Scope | Dependencies | Deliverables | Exit criteria | Tests | Rollback and failure considerations |
| --- | --- | --- | --- | --- | --- | --- |
| A0 Bible and contracts | Durable docs, contracts, ADRs, diagrams | Existing TradeOS Bible and module docs | `docs/athena/**` | PR reviewed; docs checks pass | docs checks, diff audit | Revert docs-only PR if contracts conflict |
| A1 AI kernel | Runtime shell, model adapter abstraction, prompt boundary | A0 | Kernel service skeleton, no business tools | Can accept request and return no-op response | unit tests, trace assertions | Feature flag off returns legacy UI |
| A2 Tool registry | First-party registry and schema validation | A1 | Registry, metadata loader, version checks | Unknown or invalid tools fail closed | contract tests | Disable registry flag |
| A3 Context engine | Immutable context assembly with providers | A1, A2 | Provider contracts, freshness metadata, degraded context | Missing provider degrades without fabricating facts | provider tests, cache tests | Fall back to minimal request/user context |
| A4 Permissions | Capability policy and approval classification | A2, A3 | Permission service integration and risk policy | Unauthorized tool never executes | authorization and tenant tests | Require approval for all non-read actions |
| A5 Router and planner | Intent routing, plan construction, explanation | A1-A4 | Planner contract and hidden orchestration | Plans reference only registered tools | planner tests, AI eval | Route to human-readable fallback |
| A6 Action engine | Execution, approvals, idempotency, retries | A2-A5 | Action records and approval gate | Duplicate execution is safe | retry/failure tests | Stop pending actions, preserve audit trail |
| A7 Memory | Preference, org, project/job memory | A3-A6 | Memory store, correction, deletion, attribution | Memory is source-attributed and deletable | memory tests, privacy tests | Disable writes; keep reads read-only |
| A8 Event integration | Canonical business events from tools/services | A6 | Event publisher, subscriber rules, DLQ | Major changes emit versioned events | event contract tests | Replay or suppress consumers by flag |
| A9 Tool SDK | First-party authoring SDK | A2, A6, A8 | Typed helpers for tools/results/events | New first-party tool passes contract suite | SDK tests | Fall back to direct registry definitions |
| A10 Observability | Logs, metrics, traces, costs, audits | A1-A9 | Trace IDs, telemetry contract, dashboards | Requests and actions are traceable | smoke tests, redaction tests | Disable non-critical sampling/export |
| A11 Security hardening | Injection defenses, abuse controls, sandbox policy | A4-A10 | Threat model, adversarial suite | High-risk actions approval-gated | prompt-injection, rate-limit, tenant tests | Disable plugins/tools by capability |
| A12 Business tool rollout | CRM, estimating, dispatch, billing tools | A1-A11 | First-party tool set routed to services | Production beta users complete journeys | integration, E2E, smoke tests | Disable individual tools by registry flag |
| A13 Plugin SDK | Third-party manifests, review, marketplace lifecycle | A9-A11 | Plugin manifest, install/uninstall, sandbox | Only approved plugins run | plugin contract/security tests | Revoke plugin and invalidate grants |
| A14 Voice/mobile readiness | Multimodal UX and mobile context | A3-A12 | Voice-safe confirmations, mobile context providers | Field users can use approved low-risk flows | mobile E2E, latency tests | Disable voice channel independently |

## Sequencing Rules

- Do not add autonomous writes before A4 permissions and A6 action execution
  are complete.
- Do not persist long-term memory before A7 retention, deletion, and audit
  controls are defined in code.
- Do not accept third-party tools before A11 sandboxing and A13 plugin review
  controls are implemented.
- Do not bypass existing TradeOS application services to accelerate Athena.
