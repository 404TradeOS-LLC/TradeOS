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

| Area | State | Customer UI behavior | Truth requirement |
| --- | --- | --- | --- |
| Access | Link issued | Open portal action only after real issuance | Do not imply email delivery from issuance alone |
| Access | Valid link | Redeem and establish supported customer session | Customer + tenant checks must pass |
| Access | Invalid | Explain that the link cannot be used | No resource detail leakage |
| Access | Expired | Explain expiry and provide only supported recovery path | No silent session creation |
| Access | Revoked | Explain access is no longer valid | No replay |
| Access | Already used / replay | Deny safely | Preserve single-use semantics |
| Session | Active | Load only customer-scoped resources | Forced RLS + resource checks |
| Session | Expired | Return to access/recovery state | No stale privileged view |
| Project | Available | Show supported project summary | No invented progress percentage |
| Proposal | Available | Show customer-facing proposal truth | Totals/scope from persisted proposal |
| Proposal | Decision pending | Present supported decision actions | Do not pre-apply a choice |
| Proposal | Accept acknowledged | Show accepted only after backend acknowledgement | Attribution/audit preserved |
| Proposal | Decline acknowledged | Show declined only after backend acknowledgement | Attribution/audit preserved |
| Proposal | Request change | TARGET unless current capability contract proves it | Never fake a submitted request |
| Contract | Pending signature | Show contract and supported signing action | Narrow signer/resource policy |
| Contract | Signed | Show signed only after acknowledgement | Preserve signature/audit truth |
| Contract | Invalid/unavailable | Explain without leaking unrelated resources | No fallback to staff route |
| Invoice | Available | Show supported invoice data | Exact persisted money state |
| Payment | Handoff available | Present only the implemented handoff/action | Do not claim TradeOS processed payment unless the payment contract proves it |
| Payment | Success | Only after real processor/record acknowledgement | Exact amount/status |
| Payment | Failure | Keep invoice visible and provide safe retry/recovery | Never convert failure to paid |
| Global | Loading | Skeleton/progress without fabricated data | No stale customer data cross-session |
| Global | Empty | Explain that there is nothing available in this section | Empty ≠ error |
| Global | Error | Preserve session safety and retry where appropriate | No sensitive diagnostics |

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
2. Mark each matrix row IMPLEMENTED, PARTIAL, TARGET, or BLOCKED from current code/tests.
3. Prepare S059 exact happy-path + denial/replay/expiry evidence.
4. Prepare S054 proposal decision states only after its dependencies are satisfied.
5. Capture mobile/desktop customer-facing evidence without weakening the portal principal, RLS, signature, or payment boundaries.
