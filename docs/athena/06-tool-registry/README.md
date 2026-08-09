---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 6 - Tool Registry And Tool SDK

The Tool Registry is Athena's executable capability catalog. A tool is a stable,
versioned adapter that validates inputs, checks policy, calls an application
service, and returns the standard tool result envelope.

## Tool Interface

```ts
export interface AthenaTool<TInput, TData> {
  id: string;
  version: string;
  name: string;
  description: string;
  risk: "low" | "medium" | "high";
  permissions: string[];
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  inputSchema: unknown;
  outputSchema: unknown;
  execute(input: TInput, context: AthenaToolContext): Promise<AthenaToolResult<TData>>;
}
```

## Registration And Discovery

Tools register with metadata, schemas, permission requirements, risk class,
owner, version, deprecation status, and service dependency. Discovery returns
only tools permitted for the authenticated user, organization, feature flags,
and plugin policy.

## Required Metadata

| Field | Required behavior |
| --- | --- |
| `id` | Stable reverse-domain or namespaced ID |
| `version` | Semver-compatible contract version |
| `owner` | First-party module or approved plugin |
| `permissions` | TradeOS permissions/capabilities required |
| `risk` | Low, medium, or high default risk |
| `confirmationPolicy` | Whether approval is never/contextual/always required |
| `inputSchema` | Runtime-validated shape |
| `outputSchema` | Must be standard result envelope |
| `timeoutMs` | Maximum execution time |
| `idempotency` | Required for mutating tools |

## Confirmation Policy

Tool risk is the default. The Action Engine may raise the required approval
level based on amount, legal effect, customer visibility, destructive impact,
low confidence, stale context, plugin source, or organization policy. It may not
lower a high-risk tool below explicit approval.

## Versioning And Deprecation

- Breaking changes require a new major version.
- Compatible additions must be optional.
- Deprecated tools declare replacement, sunset date, and migration notes.
- Consumers pin major versions.
- Removed tools remain blocked with a structured error rather than silently
  disappearing from historical action records.

## Third-Party Tool Lifecycle

Third-party tools require manifest review, permission review, sandbox policy,
event and telemetry review, test evidence, install approval, organization-level
grant, ongoing compatibility checks, and revocation support.
