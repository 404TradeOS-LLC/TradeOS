---
status: draft
owner: platform
last_verified: 2026-08-11
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../04-system-architecture/README.md
  - ../09-security/README.md
  - ../08-memory/README.md
  - ../07-context-engine/README.md
  - ../06-tool-registry/README.md
  - ../contracts/README.md
  - A2-tool-registry-implementation-plan.md
  - A3-context-engine-implementation-plan.md
  - A4-permission-policy-implementation-plan.md
  - A6-action-engine-implementation-plan.md
  - A7-memory-implementation-plan.md
  - A9-tool-sdk-implementation-plan.md
  - A10-observability-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
---

# A11 Security Hardening Implementation Plan

Milestone: A11 - Security Hardening
Purpose: harden Athena against prompt injection, malicious/untrusted
context, memory poisoning, tool abuse, privilege escalation, secret
leakage, and tenant isolation failures, while making Athena secure by
default and preserving the architecture A1-A10 already established.
Implementation posture: an additive `app/modules/athena-security/`
evaluation/classification/audit layer with **zero dependencies on any
sibling Athena module** (see its own import-boundary test) - other
modules (A2, A3, A6, A7, A8, A9, A10, the kernel) call into it. It never
replaces A4 permissions, A6 execution, A7 memory ownership, A8 events, A9
Tool SDK, or A10 observability.

## A1-A10 Acceptance Summary

A11 starts from a verified A1-A10 state on this branch. Reconnaissance
before implementation found that most of A1-A10's own modules were already
built with real security controls in place, not bolted on afterward:

- A4 (`athena-permissions/policy.ts`) is a deterministic, fail-closed
  actor/role/capability/resource-scope/risk decision function that maps
  medium/high risk to `approval_required`, never a default `allow`.
- A6 (`athena-action-engine/engine.ts`, `approval.ts`) re-verifies decision
  identity binding against the exact org/actor/role/tool before executing,
  treats the resolved tool's own declared `risk` as the sole authoritative
  source (never a caller-supplied value), and binds approvals to org,
  actor, tool/version, risk, idempotency key, an input hash, and plan/step -
  a changed plan or payload invalidates the approval. The production
  approval verifier is fail-closed by default
  (`createFailClosedAthenaApprovalVerifier`).
- A7 (`athena-memory/writePolicy.ts`) already rejected any write candidate
  from an untrusted source and any candidate whose value/metadata matched a
  secret-shaped pattern, and already ranked sources (`admin_policy` >
  `application_record` > `approved_action` > `event` > `document` >
  `user_message`) so a lower-trust source cannot silently overwrite a
  higher-trust one - this is A7's own memory-poisoning defense.
- A3 (`athena-context-engine/`) already carries per-section `sensitivity`
  and filters denied fields before a section is attached to context.
- A10 (`athena-observability/alerts.ts`) already defined and evaluated
  `unauthorized_execution` and `approval_bypass_attempt` alert rules against
  real persisted telemetry - not merely reserved rule-id strings.

Given that baseline, A11's job was to close the *specific* gaps that
remained, not to re-architect a security posture that was already largely
in place. See "Gaps found and closed" below for the exact list.

## Gaps found and closed

1. **No prompt-injection detection anywhere.** Untrusted/retrieved content
   was never scanned for embedded-instruction patterns.
   `athena-security/promptInjection.ts` adds a deterministic, non-LLM
   classifier; `athena-security/contextTrust.ts` wires it into A3's
   assembler as an advisory warning (never an omission - retrieved content
   remains legitimate data to cite/summarize even when it happens to
   contain injection-shaped text), and `athena-security/riskEngine.ts`
   wires it as a hard deny when the pattern appears in the exact,
   validated payload about to reach a tool.
2. **Secret redaction was duplicated and inconsistent.** A7's write policy
   had a real pattern-based detector; A1's telemetry (`sanitizeMetadata`)
   had only a weak key-name substring denylist; A8 events and A9 tool
   results had no redaction at all before persistence.
   `athena-security/secretProtection.ts` is now the single centralized
   detector/redactor every one of those surfaces calls into.
3. **No tool trust tier.** Tools carried permissions and risk but no
   internal/verified/experimental/restricted classification.
   `athena-security/toolTrust.ts` derives one from data A2 already carries
   (`owner`, `deprecated`), gating experimental/restricted tools behind an
   explicit enablement flag additive to A2/A4's own gates.
4. **No memory classification.** `athena-security/memoryClassification.ts`
   derives user_preference/business_fact/temporary_context/
   system_knowledge/untrusted_information from a write candidate's existing
   scope/kind/source - a read model, not a new required field on the
   closed C006 contract.
5. **No cross-cutting risk aggregation/audit trail.**
   `athena-security/riskEngine.ts` sits exactly where the layered-defense
   model below places it (between Permission Evaluation and Action
   Execution), producing a `AthenaSecurityDecision` (risk level, reasons,
   required controls) that `athena-security/audit.ts` shapes into safe,
   already-redacted C011 span metadata - captured through A10's existing
   telemetry write path, not a second one.
6. **No formal threat model document.** See "Threat Model" below and the
   expanded `docs/athena/09-security/README.md`.

## Security Architecture

```text
User Input
    |
    v
Context Security          (A3 assembler + athena-security/contextTrust.ts:
    |                       advisory injection scan + trust classification)
    v
Prompt Injection Detection (athena-security/promptInjection.ts: pattern
    |                       classifier, reused by context scan + risk engine)
    v
Planner Safety Checks     (A5 router/planner - deterministic, no model call
    |                       for routing/planning itself)
    v
Permission Evaluation (A4) (athena-permissions/policy.ts - unchanged,
    |                       still sole permission authority)
    v
Risk Evaluation (A11)      (athena-security/riskEngine.ts - narrows only;
    |                       cross-tenant/secret/injection/tool-trust denies)
    v
Action Execution (A6)      (athena-action-engine/engine.ts - unchanged,
    |                       still sole execution authority)
    v
Tool Security (A2/A9)      (athena-tool-registry/dispatcher.ts +
    |                       athena-security/riskEngine.ts, same gate)
    v
Memory Security (A7)       (athena-memory/writePolicy.ts, now backed by
    |                       athena-security/secretProtection.ts)
    v
Event Security (A8)        (athena-events/publisher.ts: rejects
    |                       secret-shaped payloads before persistence)
    v
Observability (A10)        (athena-observability/alerts.ts: 3 new rule ids
                             evaluating A11's own denial signals)
```

## A4/A6 Boundary (narrowing-only guarantee)

`evaluateAthenaSecurityRisk` (`athena-security/riskEngine.ts`) takes an
already-computed `AthenaPermissionDecision`-shaped input and can only:

- pass an "allow"/"approval_required" decision through unchanged (audited,
  never altered), or
- add a **new** "deny" for one of three explicit, unambiguous signals A4/A2
  do not themselves check: a cross-tenant object reference, a secret-shaped
  tool input, or a confirmed instruction-override pattern present in the
  exact validated payload about to execute.

It never turns a "deny" into an "allow", never marks an `approval_required`
decision satisfied, and never grants a permission. It is called from two
sites, both *between* the permission decision and execution, never inside
A6's own `executeAthenaAction` or A2's tool resolution:

- `athena-kernel/service.ts`, between A4's per-step `evaluateAthenaPermission`
  call and `executeAthenaAction` (A6).
- `athena-tool-registry/dispatcher.ts`'s `dispatchAthenaTool`, a fully
  independent, not-production-wired dispatch path (see its own module
  comment) that gets the same gate for defense in depth.

## Context Trust Model

`athena-security/contextTrust.ts`'s `classifyContextTrust(section)` derives
an `AthenaContextTrustLevel` (`system_instruction` / `verified_internal` /
`organization_content` / `external_untrusted`) from A3's own section
catalog rather than adding a required field to the closed C001
`AthenaProviderSection` contract. Every current A3 provider (jobs,
customers, dispatch, knowledge runtime, weather, calendar, inventory,
notifications, memory) classifies as `organization_content` - content
Athena may cite/summarize, never authority it follows. `system_instruction`
is reserved for Athena's own system/developer prompt, assembled outside
A3's provider pipeline entirely, so a future caller has a name for
"authority" without ever being tempted to grant it to provider-sourced
data. `scanContextSectionForInjection` scans freshly-fetched section data
for injection patterns and attaches an advisory warning
(`athena_context_possible_injection`) - it never omits, truncates, or
otherwise alters the section.

## Memory Security

`athena-security/memoryClassification.ts` classifies a write candidate
without changing A7's write decision: `writePolicy.ts`'s existing
poisoning defenses (untrusted-source rejection, prohibited-content
rejection, source-rank conflict resolution) are unchanged, now backed by
the same centralized `detectSecrets` A1/A8/A9 all use instead of a
module-local duplicate.

## Tool And Action Security

`athena-security/toolTrust.ts` classifies a tool's trust tier from its
`owner`/`deprecated` metadata; `experimental`/`restricted` tools require an
explicit enablement flag beyond whatever A2/A4 already require. This is
additive to, never a replacement for, `athena-tool-registry/policy.ts`'s
`evaluateAthenaToolPolicy` or `athena-permissions/policy.ts`'s
`evaluateAthenaPermission`. Action risk classification itself is unchanged:
A6's `tool.risk` (the registered `AthenaToolDefinition`'s own declared
value) remains the sole authoritative source.

## Secret Protection

`athena-security/secretProtection.ts` is the one centralized detector/
redactor. Call sites:

- `athena-kernel/telemetry.ts`'s `sanitizeMetadata` (replaces the previous
  key-name-only denylist for credential-shaped fields).
- `athena-memory/writePolicy.ts`'s `detectProhibitedMemoryContent` (now
  delegates instead of duplicating the pattern list).
- `athena-tool-sdk/results.ts`'s `successResult` (redacts `data` in place -
  a tool's own free-form return value, not a schema-typed business record).
- `athena-events/publisher.ts` (rejects a secret-shaped event `payload`
  outright rather than silently mutating structured business data other
  services deserialize by field name).

## Security Audit Evidence

`athena-security/audit.ts`'s `buildAthenaSecurityAuditMetadata` shapes a
`AthenaSecurityDecision` into plain, already-redacted C011 span metadata -
IDs, decision, risk level, reason codes, detector/pattern *names* only,
never raw prompt/tool-input/model-output content. The kernel attaches it to
the existing `approval` span it already emits at that point via
`recordAthenaTelemetry` - no second telemetry write path.

## Alert Integration (A10)

Three new rule ids in `athena-observability/types.ts`'s
`athenaAlertRuleIds`, each evaluated in `alerts.ts` by
`evaluateSecurityRiskDenialRule` reading the `layer: "athena_security_risk_engine"`
+ `securityReasons` metadata A11's gate attaches to denied `approval`
spans:

| Rule id | Severity | Fires on |
| --- | --- | --- |
| `cross_tenant_access_attempt` | critical | `athena_security_denied_cross_tenant_reference` |
| `secret_leak_detected` | critical | `athena_security_denied_secret_shaped_input` |
| `prompt_injection_detected` | high | `athena_security_denied_confirmed_prompt_injection` |

Each is an already-confirmed abuse signal, not a rate-based heuristic - any
single occurrence fires by default (`*_THRESHOLD` env vars default to `1`),
matching `approval_bypass_attempt`'s existing posture.

## Threat Model

See `docs/athena/09-security/README.md`'s "Threat Model" section for the
full assets/attackers/trust-boundaries/attack-paths/mitigations writeup.
Summary:

- **Assets**: TradeOS tenant business data, credentials/secrets, Athena's
  own permission/approval decisions, memory records, telemetry/audit
  trail, and Athena's own system instructions.
- **Attackers**: an authenticated-but-lower-privilege org member, a
  malicious or compromised customer/supplier submitting content Athena
  will read, a compromised or buggy first-party tool, and (out of scope
  for A11, in scope for A13) a malicious third-party plugin.
- **Trust boundaries**: bearer JWT + org-membership + RLS (unchanged, the
  existing floor); A4's permission decision; A11's risk-evaluation gate;
  A6's approval-binding check; A7's write-policy trust check.
- **Attack paths covered**: prompt injection via retrieved content or tool
  output (contextTrust.ts, riskEngine.ts), secret exfiltration via
  telemetry/memory/events/tool-results (secretProtection.ts everywhere),
  cross-tenant object reference in a tool call (riskEngine.ts), memory
  poisoning (unchanged A7 defenses, now on the shared detector), unverified
  approval reuse (unchanged A6 binding).

## A4/A6/A7/A8/A9/A10 Boundary Confirmation

- A4 still owns every permission/role/grant/approval-requirement decision -
  `athena-security` never calls `getRolePermissions` or produces an
  `AthenaPermissionDecision` itself.
- A6 still owns action execution, retries, and the approval lifecycle -
  `athena-security/riskEngine.ts` is called by the kernel/dispatcher
  *before* A6, never from inside `engine.ts`.
- A7 still owns memory read/write/forget - `athena-security` only
  classifies and detects, `writePolicy.ts` still decides.
- A8 still owns event publish/dispatch/replay - A11 only adds a reject-on-
  detect guard inside the existing `publishAthenaEvent` validation step.
- A9 still owns the Tool SDK's public surface - A11 only redacts `data`
  inside the existing `successResult`/`failureResult` builders.
- A10 still owns telemetry/alerts/audit - A11 produces plain metadata
  objects a caller attaches to an existing span; it never persists
  anything itself.

## Explicit Non-Goals (deferred to A12/A13)

No Plugin SDK, third-party plugin security, marketplace security,
compliance framework, SIEM/WAF, or business-tool rollout. `toolTrust.ts`'s
`restricted`/`experimental`/`plugin:` owner-prefix handling is kept ready
for A13's plugin catalog but is unreachable in production today (no
plugin/experimental tool is registered anywhere in this milestone).

## Testing

See `app/tests/athena-security.*.test.ts` for the security module's own
contract/unit tests, plus targeted additions to
`athena-memory.writePolicy.test.ts`, `athena-events.publisher.test.ts`,
`athena-tool-sdk.results.test.ts`, `athena-kernel.telemetry.test.ts`,
`athena-context-engine.assembler.test.ts`, `athena-tool-registry.dispatcher.test.ts`,
and `athena-observability.alerts.test.ts` for each integration point. Full
regression: `npm test` (all A1-A11 suites), `npm run lint`, `npx tsc --noEmit`,
`npm run build`.
