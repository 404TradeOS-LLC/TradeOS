---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_docs:
  - ../roadmap/A11-security-hardening-implementation-plan.md
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
| Object scope | Resource access is checked through application services before context providers or tools expose customer, project, job, estimate, invoice, or file data |
| Field filtering | Denied fields are removed before data reaches prompts, telemetry, memory, plugins, or user-visible summaries |
| RLS floor | Forced PostgreSQL RLS remains the isolation floor; Athena policy checks are defense in depth |
| Tool authorization | Registry discovery and execution both evaluate permissions and feature policy |
| Approval gates | High-risk actions require explicit approval outside the LLM |
| Auditability | Major actions record actor, org, entity, action, approval, result, timestamp, and safe metadata |

## Permission Enforcement Path

Athena tools do not inherit controller-level authorization automatically. Before
a tool calls an application service, Athena must run a deterministic permission
adapter that maps actor, organization, role, capability, resource scope, risk,
and organization policy to a decision. Services exposed to Athena must either
accept actor/policy context directly or sit behind a policy-checked facade.

Role grants are not enough for object access. Field technicians, for example,
may have job-reading capabilities while still being limited to assigned job and
project context. Providers and tools must ask service-owned queries for
actor-scoped data instead of broad org-scoped data.

## High-Risk Action Policy

Athena may draft, recommend, classify, and prepare. It must not finalize pricing,
permissions, contracts, invoices, dispatch changes, destructive actions, or
legally consequential communications without the existing service-level approval
path and an explicit approval record.

Approval records bind to the exact action payload. They include approval actor,
timestamp, expiration, risk class, tool/version, target entity, idempotency key,
and a hash of the approved input. A changed plan or changed target invalidates
the approval and returns to policy evaluation.

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

Legacy or weaker write paths are not automatically Athena-safe. Athena estimate
tools must use the reviewed structured estimator and existing Estimate Engine
handoff path; they must not wrap legacy AI apply routes that lack equivalent
review-token, idempotency, and source-key safeguards.

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

## Threat Model (A11)

Implemented by `app/modules/athena-security/`
(`docs/athena/roadmap/A11-security-hardening-implementation-plan.md`), which
adds a security *evaluation, classification, and audit* layer over the
decisions this document already required of A3/A4/A6/A7/A8/A9/A10 - it does
not replace any of them.

### Assets

- TradeOS tenant business data (customers, jobs, estimates, invoices,
  documents) reachable through Athena's context providers and tools.
- Credentials and secrets (API keys, tokens, passwords, connection
  strings) that must never reach a prompt, telemetry record, memory
  record, tool result, or event payload.
- Athena's own permission and approval decisions (A4/A6) - the mechanism
  that stands between a request and a real side effect.
- Memory records (A7) - durable, reused across future turns, so a
  poisoned record has a longer-lived blast radius than a single bad
  response.
- The telemetry/audit trail (A10/C011) - the record a human uses to detect
  and investigate an incident.
- Athena's own system/developer instructions - the one thing in the whole
  pipeline that is authority rather than content.

### Attackers (trust levels)

- **An authenticated, lower-privilege org member** - legitimate bearer
  JWT and org membership, attempting an action their role/permissions
  should not allow (privilege escalation, forged execution context).
- **A malicious or compromised counterparty** (customer, supplier) whose
  submitted content (a note, an email, an uploaded document) Athena's
  context providers or Knowledge Runtime will retrieve and summarize -
  content, never authority, but the source of prompt-injection attempts.
- **A compromised or buggy first-party tool** - passes A2 registration but
  returns malicious/unsafe output (tool-output injection, hidden side
  effects, secret-shaped data in its result).
- **Cross-tenant probing** - a request that is valid for one org attempting
  to reference, by a known id, a resource/memory/tool/trace belonging to a
  different org.
- **A malicious third-party plugin** - explicitly out of scope for A11 (see
  "Plugin Sandboxing" above and A13); `athena-security/toolTrust.ts`'s
  `restricted`/`plugin:` classification is kept ready for that milestone
  but unreachable in production today.

### Trust boundaries

1. Bearer JWT verification + organization-membership authorization +
   forced PostgreSQL RLS (unchanged - the existing floor every other layer
   sits on top of).
2. A4's permission decision (`athena-permissions/policy.ts`) - the sole
   authorization authority.
3. A11's risk-evaluation gate (`athena-security/riskEngine.ts`) - narrows
   an already-permitted path further; never widens one.
4. A6's approval-binding check (`athena-action-engine/approval.ts`) - an
   approval is bound to exact org/actor/tool/risk/idempotency-key/input-hash/
   plan/step, fail-closed by default.
5. A7's write-policy trust check (`athena-memory/writePolicy.ts`) - an
   untrusted or secret-shaped write candidate is rejected before storage.

### Attack scenarios and mitigations

| Scenario | Mitigation |
| --- | --- |
| User message tries to override Athena's own instructions ("ignore previous instructions...") | Kernel keeps system/developer instructions structurally separate from user message content; A11's `promptInjection.ts` additionally classifies the pattern for audit. |
| A retrieved context section (customer note, knowledge-runtime record) contains an embedded instruction | `athena-security/contextTrust.ts` classifies every A3 section as `organization_content` (data, never authority) and flags a match as an advisory warning - the section is still assembled, never silently altered. |
| A tool's own output contains an embedded instruction or malicious command | `detectPromptInjectionDeep` is available for tool-output scanning; the exact validated payload about to reach a *subsequent* tool call is scanned by `riskEngine.ts` and denied on a confirmed match. |
| Memory contains a malicious or false "trusted" instruction | Unchanged A7 defense: `writePolicy.ts` rejects any candidate whose `source.trusted` is false, and rejects secret-shaped content regardless of trust. |
| A caller attempts to invoke a tool with insufficient permissions | A4 denies (unchanged); A11 never re-derives or overrides this. |
| A permission-granted, risk-blocked action is executed without approval | A6's fail-closed approval verifier plus A10's `approval_bypass_attempt`/`unauthorized_execution` alert rules (unchanged, pre-A11). |
| A tool input carries a secret-shaped value (an API key pasted into a chat message) | `riskEngine.ts` denies via `detectSecrets`; A10's `secret_leak_detected` alert fires. |
| A request references a resource/id belonging to a different org | `riskEngine.ts` denies via its `referencedOrgId` check when a caller has resolved one; A10's `cross_tenant_access_attempt` alert fires. RLS remains the unconditional floor regardless of this check. |
| A secret ends up in telemetry, memory, tool results, or an event payload | `athena-security/secretProtection.ts` is the single centralized detector/redactor called from all four surfaces (see the roadmap plan's "Secret Protection" section for exact call sites). |
| An experimental/unreviewed tool is reachable without explicit opt-in | `toolTrust.ts` requires an explicit enablement flag for `experimental`/`restricted` tools, additive to A2/A4. |

Explicitly out of scope for A11 (unchanged from before this milestone):
Plugin SDK security, marketplace review, a full SIEM/WAF, and any new
authorization or execution engine - see the roadmap plan's "Explicit
Non-Goals" section.
