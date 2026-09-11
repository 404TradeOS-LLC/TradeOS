---
status: draft
owner: platform
last_verified: 2026-09-10
source_of_truth: true
related_docs:
  - ../roadmap.md
  - ../11-plugin-sdk/README.md
  - ../09-security/README.md
  - ../contracts/README.md
  - A9-tool-sdk-implementation-plan.md
  - A10-observability-implementation-plan.md
  - A11-security-hardening-implementation-plan.md
  - A12-business-tool-rollout-implementation-plan.md
---

# A13 Plugin SDK Implementation Plan

Milestone: A13 - Plugin SDK

Purpose: introduce governed third-party Athena extensions using the existing
C012 plugin contract and the already-landed A2/A4/A6/A8/A9/A10/A11 runtime,
without creating a second tool registry, permission system, event bus,
observability stack, or execution engine.

## 1. Source-of-truth scope

The roadmap defines A13 as third-party manifests, review, marketplace lifecycle,
install/uninstall, and sandboxing. Its exit criterion is: **only approved
plugins run**. Rollback must revoke the plugin and invalidate its grants.

C012 remains the canonical manifest contract. A13 may add compatible optional
fields, but must not replace C012 with a parallel manifest model.

## 2. Architecture

```text
Third-party plugin package
        |
        v
C012 manifest validation
        |
        v
Publisher + capability review
        |
        v
Organization install + explicit grants
        |
        v
A11 sandbox / trust gate
        |
        +--> A2 tool registry (C002/C003)
        +--> A3 context providers (C010)
        +--> A8 reviewed event subscriptions (C008)
        |
        v
A4 permission evaluation
        |
        v
A6 action execution
        |
        v
Application-service boundary
        |
        v
A10 telemetry / health / audit
```

A13 does not permit plugins to access Prisma, tenant database handles, secrets,
raw internal prompts, hidden reasoning, or unrestricted network access.

## 3. First implementation slice

The first slice establishes the contract and governance boundary before any
third-party code can run:

1. `athena-plugin-sdk` module with C012-compatible manifest types.
2. Runtime manifest schema validation.
3. Contract-major compatibility validation.
4. Capability normalization for tools, context providers, consumed/published
   events, permissions, network hosts, and data-use declarations.
5. Stable validation/review reason codes.
6. No plugin loading or execution until install state, grants, publisher review,
   and sandbox gates exist.

## 4. Required lifecycle

A13 must eventually implement this state machine:

```text
submitted
  -> validation_failed
  -> pending_review
  -> approved
  -> installed
  -> disabled
  -> revoked
  -> uninstalled
```

Updates must be revalidated for contract compatibility and capability expansion.
Capability expansion requires fresh approval rather than inheriting prior grants.

## 5. Publisher governance

Plugins require an attributable publisher identity and review state. Publisher
trust is not inferred from a manifest string alone. The implementation must
keep publisher verification/review separate from plugin-supplied content.

## 6. Organization grants

Installation is organization-scoped. Grants must be explicit and least
privilege. A plugin manifest may request capabilities, but the installed grant
set is server-owned and may be narrower than the request.

A plugin ID, tool ID, trace ID, or manifest is never authorization by itself.

## 7. Tool integration

Third-party tools must still satisfy C002/C003 and pass through A2, A4, A6,
A10, and A11. A13 must not create a plugin-only dispatcher that bypasses those
boundaries.

A11 already classifies `plugin:`/third-party owners as `restricted` and requires
explicit enablement. A13 should use that existing seam rather than duplicate it.

## 8. Context provider integration

Plugin context providers must satisfy C010 including activation mode, freshness,
permissions, sensitivity, cache key policy, size budgets, and failure behavior.
Provider output is untrusted content and cannot change instruction authority.

## 9. Event integration

Plugin event subscriptions must reference registered C008 event type/version
pairs and must be review-approved. Plugins may not fabricate canonical TradeOS
business events. Any future plugin-published event namespace must be explicitly
registered and governed rather than dynamically accepted from manifest text.

## 10. Network sandbox policy

Network access is deny-by-default. A manifest may request allowed hosts, but the
server-owned installed policy is authoritative. Wildcard/all-network access is
not permitted by default. Redirects, DNS/IP edge cases, loopback/private-network
access, metadata endpoints, and credential forwarding must be covered by the
sandbox policy before live third-party network execution is enabled.

## 11. Data-use policy

Plugins must declare customer-data storage/retention behavior. Install review
must surface data-use declarations and reject unsupported or undeclared use.
Secrets and raw private reasoning are never valid plugin data-use categories.

## 12. Install/uninstall/revocation

Install requires:

- valid C012 manifest
- compatible Athena contract major
- approved publisher/plugin review
- organization authorization
- explicit capability grants
- sandbox policy

Uninstall/revocation must:

- disable plugin tools/providers immediately
- invalidate organization grants/credentials
- stop event delivery to the plugin
- preserve audit history
- prevent stale registry/provider handles from continuing execution

## 13. Persistence

Use tenant-scoped, RLS-protected persistence consistent with existing TradeOS
patterns for plugin catalog/review/install/grant state if persistence is needed.
Do not trust org IDs from request payloads as authority.

## 14. Observability

Plugin validation, review, installation, enable/disable, revocation, dispatch,
and sandbox denials must emit safe A10/C011-compatible telemetry/audit evidence.
Do not introduce a plugin-specific telemetry platform.

## 15. Explicit exclusions

A13 does not implement:

- A14 voice/mobile readiness
- arbitrary native-code execution
- unrestricted filesystem access
- unrestricted shell/process execution
- unrestricted network access
- plugin access to Prisma/raw DB handles
- plugin access to secrets
- plugin access to hidden planner/model reasoning
- a second tool registry or action engine
- a second permission system
- a second event bus
- a second observability system
- payment settlement or commercial marketplace billing unless separately scoped

## 16. Acceptance criteria

A13 is complete only when:

- C012 manifests are validated at runtime.
- incompatible plugins fail closed.
- unapproved plugins cannot load or run.
- publisher/review state is server-owned.
- organization installs/grants are explicit and tenant-scoped.
- capability expansion requires review.
- plugin tools still pass A2/A4/A6/A10/A11 boundaries.
- plugin context providers satisfy C010.
- event subscriptions are registered/reviewed.
- network policy is deny-by-default and sandboxed.
- uninstall/revocation invalidates grants and runtime availability.
- contract/security/tenant/revocation tests pass.
- no A14 work is included.

## 17. Rollback

Disable plugin loading globally or per organization, revoke plugin grants, and
invalidate installed runtime handles while preserving audit history and
first-party Athena operation.
