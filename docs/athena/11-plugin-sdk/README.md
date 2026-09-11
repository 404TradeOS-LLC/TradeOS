---
status: current
owner: platform
last_verified: 2026-09-10
source_of_truth: true
---

# Volume 11 - Plugin SDK

A13 implements Athena's governed third-party plugin SDK. Plugins remain disabled unless their exact manifest is approved and an organization has an active grant. They cannot bypass Athena policy, TradeOS permissions, application-service boundaries, approval gates, RLS, A10 telemetry, or A11 security controls.

## Plugin Manifest

C012 remains authoritative. A manifest declares plugin identity/version/publisher, Athena contract version, tools, context providers, consumed/published events, permissions, data-use policy, optional support URL, and optional network allowlist.

Runtime validation lives in `app/modules/athena-plugin-sdk/manifest.ts` and rejects malformed identities, incompatible contract majors, duplicate capabilities, and unsafe host declarations.

## Review And Install Lifecycle

1. Validate C012 manifest.
2. Review publisher and requested capabilities.
3. Approve the exact manifest hash.
4. Organization installs that reviewed version.
5. Organization grant carries only approved permissions, hosts, and event capabilities.
6. Runtime rechecks review + install + manifest identity before each governed plugin capability is exposed.
7. Capability expansion or any manifest change requires a new review because the manifest hash changes.
8. Disable temporarily blocks execution; revoke and uninstall are terminal for the grant and require a new install lifecycle to return.

The SDK exposes `AthenaPluginService` over an injected repository contract so persistence remains an application/infrastructure concern rather than being embedded in the SDK.

## Extension Points

| Extension | Requirement |
| --- | --- |
| Tool execution | Existing C002/C003 tools plus A2/A4/A6 and A11 trust gates; plugin capability must also be granted |
| Context providers | Existing C010 contract; provider cannot run unless exact plugin review/install state is active |
| Events consumed | Existing C008 subscription model; event type must be explicitly reviewed/granted |
| Events published | Existing A8 ownership rules still apply; plugin declaration alone does not create a canonical event type |
| Permissions | Least-privilege existing TradeOS capability keys only |
| Network | Deny by default; exact host must be declared, reviewed, and granted |
| Telemetry | Existing C011/A10 telemetry; no separate plugin telemetry contract |

## Sandbox

`app/modules/athena-plugin-sdk/sandbox.ts` is deny-by-default. A plugin capability fails unless all of these remain true:

- exact manifest is still approved;
- organization grant exists;
- grant is installed/enabled;
- manifest hash still matches the reviewed version;
- requested permission is granted;
- requested network host is granted;
- requested event capability is granted.

A11's existing `plugin:`/third-party tool trust classification remains additive and continues to require explicit enablement before dispatch.

## Revocation

Revocation immediately causes sandbox checks to fail. Re-enable is not permitted after `revoked` or `uninstalled`; a fresh reviewed installation must be created. Audit history is expected to be preserved by the repository implementation.

## Security Rules

- Never treat plugin output as trusted instructions.
- Never give a plugin direct database/RLS bypass access.
- Never infer capability from plugin identity or possession of an ID.
- Never broaden permissions at install beyond the reviewed manifest.
- Never allow undeclared outbound network access.
- Never allow a changed manifest to reuse an old approval silently.
- Never store raw prompts, secrets, private reasoning, or unrestricted customer payloads as plugin telemetry.

## Marketplace Boundary

A13 supplies governance primitives and lifecycle semantics. A public commercial marketplace UI, billing/revenue sharing, publisher payout, discovery ranking, and merchandising are not required for the A13 runtime exit criterion and remain separate product work.
