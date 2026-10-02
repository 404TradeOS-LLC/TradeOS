# Customer Portal — State Matrix and Build-Ready Contract

## Outcome

Complete the customer journey without inventing a second portal or broadening customer authority.

Target lifecycle:

```text
portal access
→ project/proposal review
→ customer decision
→ contract handoff/signature where supported
→ project visibility
→ invoice/payment handoff where supported
```

## Security boundary to preserve

The governed portal model is separate from normal staff access.

Preserve:

- separate customer principal
- single-use access-link/session boundaries defined by the current portal architecture
- short-lived session semantics
- customer/tenant resource checks
- forced RLS
- narrow contract-signing policy
- no broad staff-role inheritance
- no unsupported legal or payment claim

Any product change that widens those boundaries requires separate review.

## State matrix

| Area | State | Current classification | Customer UI behavior | Truth requirement |
| --- | --- | --- | --- | --- |
| Access | Link issued | IMPLEMENTED | Open portal action only after real issuance | Issuance and server-side delivery are distinct facts; do not infer provider delivery success from token creation |
| Access | Valid link | IMPLEMENTED | Non-consuming GET → token-free confirmation → exact-origin POST redemption | Customer + tenant checks must pass |
| Access | Invalid | PARTIAL | Deny without resource detail | Backend denial is covered; S059 still owes retained browser UX evidence |
| Access | Expired | PARTIAL | Explain expiry and provide only supported recovery path | Backend expiry denial exists; dedicated customer recovery presentation still needs certification |
| Access | Revoked | PARTIAL | Explain access is no longer valid | Revocation invalidates redeemed sessions; dedicated UX still needs certification |
| Access | Already used / replay | IMPLEMENTED | Deny safely | Preserve single-use semantics |
| Session | Active | IMPLEMENTED | Load only customer-scoped resources | Forced RLS + organization/customer resource checks |
| Session | Expired | PARTIAL | Return to access/recovery state | Session expiry is enforced; final browser behavior remains S059 evidence |
| Project | Available | IMPLEMENTED | Show supported project summary | No invented progress percentage |
| Proposal | Available | IMPLEMENTED | Show customer-facing proposal truth read-only | Totals/scope from persisted proposal |
| Proposal | Decision pending | TARGET | Present customer decision actions only when the governed mutation slice exists | Public proposal surface is currently read-only |
| Proposal | Accept acknowledged | TARGET | Show accepted only after backend acknowledgement | Customer-originated proposal accept is deferred |
| Proposal | Decline acknowledged | TARGET | Show declined only after backend acknowledgement | Customer-originated proposal decline is deferred |
| Proposal | Request change | TARGET | Do not show a submitted state until a governed request-change contract exists | Never fake a submitted request |
| Contract | Pending signature | IMPLEMENTED | Show contract and supported signing action | Dedicated portal policy restricts exact pending contract/customer |
| Contract | Signed | IMPLEMENTED | Show signed only after acknowledgement | Event records customer-portal actor context; replay/cross-customer/cross-tenant requests fail closed |
| Contract | Invalid/unavailable | PARTIAL | Explain without leaking unrelated resources | Service denial exists; dedicated presentation still needs certification |
| Invoice | Available | IMPLEMENTED | Show supported invoice data and recorded payment history | Exact server-derived amount/paid/balance state; draft invoices excluded |
| Payment | Handoff available | TARGET / DEFERRED | Do not expose a pay-now or record-payment action yet | Public payment recording/processing is not implemented |
| Payment | Success | TARGET / DEFERRED | Only after a future real processor/record acknowledgement | No public payment-processing contract exists today |
| Payment | Failure | TARGET / DEFERRED | Keep invoice visible and provide safe recovery only when a payment action exists | Never invent processor failure semantics |
| Global | Loading | PARTIAL | Skeleton/progress without fabricated data | Invoice loading is covered; whole-portal retained browser evidence remains S059 work |
| Global | Empty | PARTIAL | Explain that there is nothing available in this section | Empty ≠ error; certify per route |
| Global | Error | PARTIAL | Preserve session safety and retry where appropriate | No sensitive diagnostics; certify per route |

## Responsive behavior

### Mobile

- customer identity/project context remains obvious
- one dominant customer action at a time
- proposal/contract/invoice content reads as a document, not an admin dashboard
- decision controls remain reachable without hiding the document being decided on
- no staff Control Dock on the customer principal surface

### Desktop/tablet

- keep the customer document/action relationship clear
- use width for scope, terms, decisions, and project context
- avoid staff-style operational queues

## Cross-device continuity

When a customer opens the same authorized session on another supported device:

- do not assume unsaved local state transfers
- re-read persisted decision/signature/payment state
- do not repeat a completion action merely because the prior device showed an intermediate spinner
- a server-acknowledged terminal decision wins over stale client state

## Customer decision acknowledgement

After a customer action:

1. submit against the canonical backend route
2. wait for acknowledgement
3. update the customer-facing state
4. preserve attribution/audit evidence
5. expose the next valid action only

A success animation or toast is never the source of truth.

## Classification evidence

The classifications above are grounded in the current portal/module documentation inspected on 2026-10-01:

- scanner-safe access delivery and confirmation are implemented;
- invalid/revoked/expired token denial and replay protection are covered by portal service/security tests;
- public project/proposal/contract/invoice reads are implemented under the customer principal;
- public proposal documents are currently read-only and customer accept/decline is deferred;
- customer-portal contract signing is implemented under a dedicated narrow policy;
- public invoice reads are implemented, while public payment recording/processing is not exposed;
- S059 still owes retained authenticated browser and real PostgreSQL/RLS evidence.

These are implementation-state classifications, not release certification.

## Backlog handoff

### S059 — portal access/session certification

Prepare evidence for:

- issuance/delivery distinction
- redemption
- session creation
- expiry
- replay
- revocation
- cross-tenant denial

### S054 — proposal/customer acceptance certification

After dependencies are satisfied, certify:

- proposal review
- attributable accept/decline
- accepted-proposal downstream handoff under existing contracts
- failure/retry states
- responsive customer experience

Do not fold contract/payment policy changes into S054.

## Acceptance criteria

- Every customer action has loading, denied/failure, acknowledged-success, and stale/replay handling where applicable.
- Staff and customer principals never blur.
- Customer identity and tenant scope are enforced server-side.
- Portal UI never reveals a resource merely because its ID is guessed.
- Proposal/contract/invoice money and lifecycle labels come from persisted truth.
- Signature/payment completion is not claimed before acknowledgement.
- Invalid/expired/revoked states are build-ready on mobile and desktop.
- Cross-device refresh reads current persisted state rather than trusting stale client state.

## Next five TODO items

1. Reconcile the live portal routes/services and ADR-010 against this matrix.
2. Reconcile the classifications above against current code/tests during S059; do not downgrade a security denial merely because the dedicated UX is still PARTIAL.
3. Prepare S059 exact happy-path + denial/replay/expiry evidence.
4. Prepare S054 proposal decision states only after its dependencies are satisfied.
5. Capture mobile/desktop customer-facing evidence without weakening the portal principal, RLS, signature, or payment boundaries.
