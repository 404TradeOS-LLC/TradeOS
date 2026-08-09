---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 9 - Security And Permissions

Athena is permission-aware, not permission-authoritative. It requests tool
execution; server-side TradeOS services authorize and execute.

## Security Invariants

| Invariant | Requirement |
| --- | --- |
| Tenant isolation | Organization context comes from verified bearer auth and active membership, never request-controlled tenant fields |
| RBAC | Use canonical roles `owner`, `admin`, `dispatcher`, `technician`; legacy `estimator` and `viewer` are compatibility inputs only |
| Capability checks | Tool calls map to existing TradeOS permission keys such as `crm.read`, `crm.write`, `billing.write`, `documents.manage`, and `settings.manage` |
| RLS floor | Forced PostgreSQL RLS remains the isolation floor; Athena policy checks are defense in depth |
| Tool authorization | Registry discovery and execution both evaluate permissions and feature policy |
| Approval gates | High-risk actions require explicit approval outside the LLM |
| Auditability | Major actions record actor, org, entity, action, approval, result, timestamp, and safe metadata |

## High-Risk Action Policy

Athena may draft, recommend, classify, and prepare. It must not finalize pricing,
permissions, contracts, invoices, dispatch changes, destructive actions, or
legally consequential communications without the existing service-level approval
path and an explicit approval record.

## Prompt Injection And Untrusted Content

Emails, uploaded documents, customer notes, website text, plugin responses, and
Knowledge Runtime records are content, not authority. Tool selection, approval
policy, memory writes, and permission grants cannot be changed by instructions
inside retrieved content.

Defenses:

- isolate trusted system/developer policy from retrieved content;
- cite source records used in recommendations;
- require schema validation before tool execution;
- block external content from creating memory without trusted confirmation;
- sanitize plugin/tool output before it reaches planner or memory paths;
- redact secrets and unnecessary PII from prompts and telemetry.

## Secrets, PII, And Data Minimization

Athena must not expose service-role credentials, database URLs, API keys, raw
payment data, private storage URLs, or infrastructure internals to the LLM or
third-party plugins. Context providers should send the minimum useful summary
for the task. Telemetry defaults to redacted values.

## Abuse Controls

- Per-user, per-org, per-tool, and per-plugin rate limits.
- Cost budgets by organization and environment.
- Tool-specific timeout and concurrency limits.
- Lockout or step-up approval after repeated denied or failed high-risk actions.
- Admin revocation for plugins, tools, memories, and pending actions.

## Plugin Sandboxing

Third-party plugins run with explicit manifests, least-privilege capability
grants, sandboxed execution, reviewed network/storage access, output
validation, telemetry, and revocation. A plugin cannot receive broad context or
invoke a tool merely because it is installed.
